#!/usr/bin/env python3
"""
Japanese AI Tutor - Supervised Fine-Tuning (SFT) Pipeline
Fine-tunes conversational models using QLoRA, PEFT, TRL, and BitsAndBytes.

Features:
- 4-bit NF4 Quantization (QLoRA) tailored for NVIDIA GeForce RTX 4050 (6GB VRAM)
- Comprehensive LoRA targeting for Qwen models (q, k, v, o, gate, up, down)
- Gradient Checkpointing & Paged 8-bit AdamW
- Real-time VRAM monitoring callback
- Checkpointing, Resumability, and Training Config export
- Automated post-training adapter validation (loads base model + adapter & runs generation)
"""

import os
import sys
import time
import json
import yaml
import argparse
import torch
from typing import Dict, Any, Optional

from datasets import load_dataset, Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainerCallback,
    TrainerState,
    TrainerControl
)
from peft import (
    LoraConfig,
    TaskType,
    get_peft_model,
    prepare_model_for_kbit_training,
    PeftModel
)
from trl import SFTTrainer, SFTConfig

from load_model import get_gpu_memory_report

# Custom Callback to Monitor VRAM and Elapsed Time during Training
class MemoryLoggingCallback(TrainerCallback):
    def __init__(self):
        super().__init__()
        self.start_time = None

    def on_train_begin(self, args, state: TrainerState, control: TrainerControl, **kwargs):
        self.start_time = time.perf_counter()
        mem = get_gpu_memory_report()
        print("\n" + "=" * 65)
        print(" 🚀 TRAINING COMMENCED")
        print(f" Initial GPU Status: {mem['summary']}")
        print("=" * 65)

    def on_log(self, args, state: TrainerState, control: TrainerControl, logs=None, **kwargs):
        if logs:
            mem = get_gpu_memory_report()
            elapsed = time.perf_counter() - self.start_time if self.start_time else 0
            loss = logs.get("loss", "N/A")
            eval_loss = logs.get("eval_loss", None)
            step = state.global_step
            epoch = logs.get("epoch", 0.0)

            msg = f"⏱️ Step {step:3d} (Ep {epoch:.2f}) | Loss: {loss} | Elapsed: {elapsed:.1f}s | VRAM: {mem['allocated_gb']:.2f} GB"
            if eval_loss is not None:
                msg += f" | Eval Loss: {eval_loss:.4f}"
            print(msg)

def validate_saved_adapter(base_model_id: str, adapter_dir: str) -> bool:
    """Verifies that the saved LoRA adapter can be loaded and executed together with the base model."""
    print("\n" + "=" * 65)
    print(" 🧪 VALIDATING SAVED LORA ADAPTER")
    print(f" Base Model: {base_model_id} | Adapter Dir: {adapter_dir}")
    print("=" * 65)

    try:
        torch.cuda.empty_cache()
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16
        )

        tokenizer = AutoTokenizer.from_pretrained(adapter_dir, trust_remote_code=True)
        base_model = AutoModelForCausalLM.from_pretrained(
            base_model_id,
            quantization_config=bnb_config,
            device_map="auto",
            dtype=torch.bfloat16,
            trust_remote_code=True
        )

        # Merge Adapter
        model = PeftModel.from_pretrained(base_model, adapter_dir)
        model.eval()

        test_prompt = "こんにちは！自己紹介をしてください。"
        messages = [
            {"role": "system", "content": "You are a Japanese AI Tutor."},
            {"role": "user", "content": test_prompt}
        ]
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(text, return_tensors="pt").to("cuda")

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=64,
                do_sample=True,
                temperature=0.7,
                pad_token_id=tokenizer.pad_token_id
            )

        resp = tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
        print(f"✅ Adapter load test PASSED!")
        print(f"   Test Prompt: {test_prompt}")
        print(f"   Generated Response: {resp.strip()[:100]}...")

        del model, base_model, tokenizer
        torch.cuda.empty_cache()
        return True

    except Exception as e:
        print(f"❌ Adapter load test FAILED: {e}")
        return False

def train_sft(
    model_id: str = "Qwen/Qwen2.5-1.5B-Instruct",
    train_file: str = "data/processed/train.jsonl",
    val_file: str = "data/processed/val.jsonl",
    output_dir: str = "adapters/japanese-ai-tutor-qlora",
    max_seq_length: int = 512,
    batch_size: int = 1,
    gradient_accumulation_steps: int = 4,
    learning_rate: float = 2e-4,
    epochs: int = 1,
    lora_r: int = 16,
    lora_alpha: int = 32,
    lora_dropout: float = 0.05,
    save_steps: int = 5,
    logging_steps: int = 1,
    seed: int = 42,
    smoke_test: bool = False,
    resume_checkpoint: Optional[str] = None
):
    print("=" * 70)
    print(" 🌸 JAPANESE AI TUTOR - QLoRA SUPERVISED FINE-TUNING")
    print(f" Mode: {'🧪 SMOKE TEST (Small subset / fast pipeline check)' if smoke_test else '🏋️ FULL FINE-TUNING'}")
    print("=" * 70)

    # 1. Dataset Loading and Validation
    if not os.path.exists(train_file):
        raise FileNotFoundError(f"Training dataset not found at: {train_file}")

    print(f"\n[1/6] Loading datasets...")
    print(f"  • Training:   {train_file}")
    print(f"  • Validation: {val_file if os.path.exists(val_file) else 'None'}")

    dataset = load_dataset("json", data_files={"train": train_file, "validation": val_file})

    train_ds = dataset["train"]
    val_ds = dataset["validation"]

    if smoke_test:
        smoke_count = min(4, len(train_ds))
        train_ds = train_ds.select(range(smoke_count))
        val_ds = val_ds.select(range(min(2, len(val_ds))))
        print(f"  🧪 Smoke test active: trimmed training to {len(train_ds)} samples and validation to {len(val_ds)} samples.")

    # 2. Tokenizer Setup
    print(f"\n[2/6] Loading Tokenizer for '{model_id}'...")
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # 3. Model Loading with 4-bit NF4 Quantization
    print(f"\n[3/6] Loading Base Model in 4-bit (NF4) for 6GB VRAM...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16
    )

    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        quantization_config=bnb_config,
        device_map="auto",
        dtype=torch.bfloat16,
        trust_remote_code=True
    )

    # Prepare for k-bit training and gradient checkpointing
    model = prepare_model_for_kbit_training(
        model,
        use_gradient_checkpointing=True
    )

    # 4. LoRA Adapter Configuration
    print(f"\n[4/6] Configuring Trainable LoRA Adapters (r={lora_r}, alpha={lora_alpha})...")
    peft_config = LoraConfig(
        r=lora_r,
        lora_alpha=lora_alpha,
        lora_dropout=lora_dropout,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    # 5. Training Arguments via SFTConfig
    print(f"\n[5/6] Setting up SFTConfig & Trainer...")
    os.makedirs(output_dir, exist_ok=True)

    sft_config = SFTConfig(
        output_dir=output_dir,
        max_length=max_seq_length,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=gradient_accumulation_steps,
        learning_rate=learning_rate,
        lr_scheduler_type="cosine",
        warmup_steps=1,
        num_train_epochs=epochs,
        logging_steps=logging_steps,
        save_strategy="steps",
        save_steps=save_steps,
        save_total_limit=2,
        eval_strategy="steps" if len(val_ds) > 0 else "no",
        eval_steps=save_steps if len(val_ds) > 0 else None,
        bf16=True,
        fp16=False,
        gradient_checkpointing=True,
        optim="paged_adamw_8bit",
        seed=seed,
        report_to="none"
    )

    # Formatting function using tokenizer chat template
    def formatting_prompts_func(example):
        if len(example["messages"]) > 0 and isinstance(example["messages"][0], list):
            return [tokenizer.apply_chat_template(conv, tokenize=False, add_generation_prompt=False) for conv in example["messages"]]
        else:
            return [tokenizer.apply_chat_template(example["messages"], tokenize=False, add_generation_prompt=False)]

    trainer = SFTTrainer(
        model=model,
        train_dataset=train_ds,
        eval_dataset=val_ds if len(val_ds) > 0 else None,
        processing_class=tokenizer,
        args=sft_config,
        formatting_func=formatting_prompts_func,
        callbacks=[MemoryLoggingCallback()]
    )

    # 6. Execute Training
    print(f"\n[6/6] Executing fine-tuning loop...")
    train_start_time = time.perf_counter()

    resume_param = resume_checkpoint if (resume_checkpoint and os.path.exists(resume_checkpoint)) else None
    if resume_param:
        print(f"🔄 Resuming training from checkpoint: {resume_param}")

    train_result = trainer.train(resume_from_checkpoint=resume_param)
    total_train_time = time.perf_counter() - train_start_time

    print(f"\n🎉 Fine-tuning finished in {total_train_time:.1f} seconds!")
    print(f"   Final Train Loss: {train_result.training_loss:.4f}")

    # 7. Save Artifacts Separately
    print(f"\nSaving final LoRA adapter to: {output_dir}")
    trainer.model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)

    # Save training configuration metadata
    metadata = {
        "base_model_id": model_id,
        "quantization": "4bit_nf4",
        "lora_r": lora_r,
        "lora_alpha": lora_alpha,
        "epochs": epochs,
        "learning_rate": learning_rate,
        "max_seq_length": max_seq_length,
        "gradient_accumulation_steps": gradient_accumulation_steps,
        "training_loss": round(train_result.training_loss, 4),
        "total_train_time_seconds": round(total_train_time, 2),
        "smoke_test": smoke_test,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    config_save_path = os.path.join(output_dir, "training_config.json")
    with open(config_save_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"   Configuration saved to: {config_save_path}")

    # Free trainer resources before validation
    del model, trainer
    torch.cuda.empty_cache()

    # 8. Post-Training Validation Test
    validation_passed = validate_saved_adapter(model_id, output_dir)
    if validation_passed:
        print("\n" + "=" * 70)
        print(" 🏆 SMOKE TEST FULLY VERIFIED & COMPLETED SUCCESSFULLY!")
        print(" The fine-tuning pipeline is confirmed functional and ready for scaling.")
        print("=" * 70)
    else:
        print("\n" + "=" * 70)
        print(" ❌ Post-training adapter validation failed. Check log for details.")
        print("=" * 70)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Japanese AI Tutor SFT Trainer")
    parser.add_argument("--model-id", type=str, default="Qwen/Qwen2.5-1.5B-Instruct", help="Base model ID")
    parser.add_argument("--train-file", type=str, default="data/processed/train.jsonl")
    parser.add_argument("--val-file", type=str, default="data/processed/val.jsonl")
    parser.add_argument("--output-dir", type=str, default="adapters/japanese-ai-tutor-qlora")
    parser.add_argument("--max-seq-length", type=int, default=512)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--grad-accum", type=int, default=4)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--lora-alpha", type=int, default=32)
    parser.add_argument("--save-steps", type=int, default=5)
    parser.add_argument("--smoke-test", action="store_true", help="Run tiny smoke test")
    parser.add_argument("--resume", type=str, default=None, help="Resume from checkpoint path")
    args = parser.parse_args()

    train_sft(
        model_id=args.model_id,
        train_file=args.train_file,
        val_file=args.val_file,
        output_dir=args.output_dir,
        max_seq_length=args.max_seq_length,
        batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        epochs=args.epochs,
        lora_r=args.lora_r,
        lora_alpha=args.lora_alpha,
        save_steps=args.save_steps,
        smoke_test=args.smoke_test,
        resume_checkpoint=args.resume
    )
