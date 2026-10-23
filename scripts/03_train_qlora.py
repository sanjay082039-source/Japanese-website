"""
Japanese AI Tutor - QLoRA Fine-Tuning Engine
Tuned specifically for NVIDIA GeForce RTX 4050 (6GB VRAM)

Features:
- 4-bit NF4 Quantization with double quantization
- LoRA on all attention & MLP projection layers
- Gradient Checkpointing to minimize activation VRAM
- Paged 8-bit AdamW optimizer
- SFTTrainer with native ChatML templating
"""

import os
import sys
import yaml
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments
)
from peft import (
    LoraConfig,
    get_peft_model,
    prepare_model_for_kbit_training
)
from trl import SFTTrainer

def load_config(config_path: str = "configs/qlora_config.yaml") -> dict:
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Config file not found at: {config_path}")
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def run_training(config_path: str = "configs/qlora_config.yaml"):
    cfg = load_config(config_path)
    model_cfg = cfg["model"]
    lora_cfg = cfg["lora"]
    train_cfg = cfg["training"]

    print("=" * 65)
    print(" Japanese AI Tutor - Starting QLoRA Fine-Tuning")
    print("=" * 65)

    base_model_name = model_cfg["base_model_name_or_path"]
    print(f"Base Model: {base_model_name}")

    # 1. BitsAndBytes 4-bit Quantization Config
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16
    )

    # 2. Load Tokenizer
    print("\n[1/5] Loading Tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        base_model_name,
        trust_remote_code=True
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # 3. Load Base Model in 4-bit
    print("\n[2/5] Loading Model in 4-bit (NF4)...")
    model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        trust_remote_code=True
    )

    # Prepare model for PEFT k-bit training & enable gradient checkpointing
    model = prepare_model_for_kbit_training(
        model,
        use_gradient_checkpointing=train_cfg.get("gradient_checkpointing", True)
    )

    # 4. Attach LoRA Adapters
    print("\n[3/5] Attaching LoRA Adapters...")
    peft_config = LoraConfig(
        r=lora_cfg["r"],
        lora_alpha=lora_cfg["lora_alpha"],
        lora_dropout=lora_cfg["lora_dropout"],
        bias=lora_cfg["bias"],
        task_type=lora_cfg["task_type"],
        target_modules=lora_cfg["target_modules"]
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    # 5. Load Dataset
    print("\n[4/5] Loading Processed Training Data...")
    train_file = "data/processed/train.jsonl"
    val_file = "data/processed/val.jsonl"
    if not os.path.exists(train_file):
        print(f"Error: {train_file} does not exist. Run scripts/01_prepare_dataset.py first.")
        sys.exit(1)

    dataset = load_dataset("json", data_files={"train": train_file, "validation": val_file})

    def formatting_prompts_func(example):
        texts = []
        for conversation in example["messages"]:
            text = tokenizer.apply_chat_template(
                conversation,
                tokenize=False,
                add_generation_prompt=False
            )
            texts.append(text)
        return texts

    # 6. Setup Training Arguments
    training_args = TrainingArguments(
        output_dir=train_cfg["output_dir"],
        per_device_train_batch_size=train_cfg["per_device_train_batch_size"],
        gradient_accumulation_steps=train_cfg["gradient_accumulation_steps"],
        learning_rate=float(train_cfg["learning_rate"]),
        lr_scheduler_type=train_cfg["lr_scheduler_type"],
        warmup_ratio=train_cfg["warmup_ratio"],
        num_train_epochs=train_cfg["num_train_epochs"],
        logging_steps=train_cfg["logging_steps"],
        save_strategy=train_cfg["save_strategy"],
        save_steps=train_cfg["save_steps"],
        save_total_limit=train_cfg["save_total_limit"],
        bf16=train_cfg.get("bf16", True),
        fp16=train_cfg.get("fp16", False),
        gradient_checkpointing=train_cfg.get("gradient_checkpointing", True),
        optim=train_cfg.get("optim", "paged_adamw_8bit"),
        report_to=train_cfg.get("report_to", "none")
    )

    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"],
        peft_config=peft_config,
        dataset_text_field="text",
        max_seq_length=train_cfg.get("max_seq_length", 1024),
        tokenizer=tokenizer,
        args=training_args,
        formatting_func=formatting_prompts_func
    )

    print("\n[5/5] Training starting...")
    vram_before = torch.cuda.memory_allocated() / (1024 ** 2)
    print(f"  VRAM allocated prior to training loop: {vram_before:.2f} MB")

    trainer.train()

    print(f"\nTraining Complete! Saving LoRA adapter weights to: {train_cfg['output_dir']}")
    trainer.model.save_pretrained(train_cfg["output_dir"])
    tokenizer.save_pretrained(train_cfg["output_dir"])
    print("Done! 🎉")

if __name__ == "__main__":
    run_training()
