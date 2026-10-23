#!/usr/bin/env python3
"""
Japanese AI Tutor - Interactive Terminal Chat Application
Provides an interactive or single-prompt conversational interface powered by
the fine-tuned QLoRA Japanese learning model.

Features:
- Validates and loads LoRA adapter (never silently falls back)
- Multi-turn conversation history management with context window pruning
- Consistent pedagogical system prompt (natural Japanese, gentle correction, general QA)
- Furigana/reading annotations and intellectual humility
- Configurable generation settings (temperature, top_p, max_tokens, repetition_penalty)
- Comprehensive error handling (missing files, OOM, invalid input)
- In-chat slash commands (/clear, /status, /history, /help)
- Non-interactive single query mode (--query) for automated verification
"""

import os
import sys
import time
import argparse
import readline  # Enables terminal command history & arrow keys
from typing import List, Dict, Any, Tuple, Optional

import torch

DEFAULT_BASE_MODEL = "Qwen/Qwen2.5-1.5B-Instruct"
DEFAULT_ADAPTER_DIR = "adapters/japanese-ai-tutor-qlora"

SYSTEM_PROMPT = (
    "You are Sensei, an encouraging, knowledgeable bilingual Japanese AI Tutor and conversation partner.\n"
    "Core Guidelines:\n"
    "1. Direct Answers: Always address the user's actual question directly first.\n"
    "2. Japanese Learning: When the user asks about Japanese, provide natural expressions with Furigana/Hiragana readings "
    "(e.g., 勉強【べんきょう】) and Romaji when helpful, followed by clear English explanations.\n"
    "3. Gentle Corrections: If the user writes Japanese with errors, gently acknowledge what they meant, highlight the mistake kindly, "
    "provide the corrected natural version, and explain the grammatical reasoning.\n"
    "4. General Knowledge: If the user asks a general question (about science, history, geography, programming, etc.), answer it accurately "
    "and directly in English. Do not force an artificial Japanese lesson into unrelated topics, though you may offer a relevant Japanese word if naturally fitting.\n"
    "5. Intellectual Humility: Never invent factual information, translations, or kanji readings. If a word's etymology, slang origin, or regional "
    "dialect usage is debated or uncertain, openly acknowledge it."
)

class ConversationManager:
    """Manages multi-turn conversation history with rolling context pruning."""
    def __init__(self, system_prompt: str = SYSTEM_PROMPT, max_history_turns: int = 8):
        self.system_prompt = system_prompt
        self.max_history_turns = max_history_turns
        self.turns: List[Dict[str, str]] = []

    def add_user_turn(self, content: str):
        self.turns.append({"role": "user", "content": content.strip()})
        self._prune_history()

    def add_assistant_turn(self, content: str):
        self.turns.append({"role": "assistant", "content": content.strip()})
        self._prune_history()

    def get_messages(self) -> List[Dict[str, str]]:
        messages = [{"role": "system", "content": self.system_prompt}]
        messages.extend(self.turns)
        return messages

    def clear(self):
        self.turns = []

    def _prune_history(self):
        # Keep only the most recent max_history_turns (pairs of user/assistant)
        max_messages = self.max_history_turns * 2
        if len(self.turns) > max_messages:
            self.turns = self.turns[-max_messages:]

def get_vram_status() -> Dict[str, float]:
    """Returns current GPU VRAM allocation in GB."""
    if not torch.cuda.is_available():
        return {"allocated_gb": 0.0, "reserved_gb": 0.0, "total_gb": 0.0}
    allocated = torch.cuda.memory_allocated() / (1024 ** 3)
    reserved = torch.cuda.memory_reserved() / (1024 ** 3)
    total = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    return {
        "allocated_gb": round(allocated, 2),
        "reserved_gb": round(reserved, 2),
        "total_gb": round(total, 2)
    }

def load_tutor_model(
    base_model_id: str = DEFAULT_BASE_MODEL,
    adapter_path: Optional[str] = DEFAULT_ADAPTER_DIR,
    quant: str = "4bit"
) -> Tuple[Any, Any, bool]:
    """
    Loads tokenizer, base causal LM, and merges LoRA adapter.
    Strictly verifies adapter loading — NEVER silently falls back to base model
    if adapter_path is provided.
    """
    print("\n" + "=" * 65)
    print(" 🌸 INITIALIZING JAPANESE AI TUTOR")
    print(f" Base Model:     {base_model_id}")
    print(f" LoRA Adapter:   {adapter_path or 'None (Base Model Only)'}")
    print(f" Quantization:   {quant}")
    print("=" * 65)

    # 1. Validation of Adapter Path
    if adapter_path is not None:
        if not os.path.exists(adapter_path):
            raise FileNotFoundError(
                f"Specified LoRA adapter path does not exist: '{adapter_path}'\n"
                f"Aborting initialization. The system will NOT silently fall back to the base model."
            )
        adapter_config_path = os.path.join(adapter_path, "adapter_config.json")
        if not os.path.exists(adapter_config_path):
            raise FileNotFoundError(
                f"Missing 'adapter_config.json' inside adapter directory '{adapter_path}'."
            )

    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from peft import PeftModel
    except ImportError as e:
        raise ImportError(f"Required ML dependencies missing: {e}. Ensure the virtual environment is active.")

    # 2. Tokenizer
    print(f"\n[1/3] Loading Tokenizer for '{base_model_id}'...")
    tokenizer = AutoTokenizer.from_pretrained(base_model_id, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # 3. Base Model with 4-bit Quantization
    print(f"[2/3] Loading Base Model in {quant} precision...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16
    ) if quant == "4bit" else None

    try:
        model = AutoModelForCausalLM.from_pretrained(
            base_model_id,
            quantization_config=bnb_config,
            device_map="auto",
            dtype=torch.bfloat16,
            trust_remote_code=True
        )
    except torch.cuda.OutOfMemoryError as e:
        raise RuntimeError(
            f"GPU Out of Memory while loading base model: {e}\n"
            f"Try closing competing GPU processes or lowering memory consumption."
        )

    # 4. LoRA Adapter Merging & Strict Verification
    is_fine_tuned = False
    if adapter_path:
        print(f"[3/3] Merging LoRA Adapter from '{adapter_path}'...")
        try:
            model = PeftModel.from_pretrained(model, adapter_path)
            # Verify adapter is active
            if not isinstance(model, PeftModel):
                raise RuntimeError("Failed to wrap base model inside PeftModel.")
            active_adapters = getattr(model, "active_adapters", ["default"])
            print(f"  ✅ Verified Active LoRA Adapter: {active_adapters}")
            is_fine_tuned = True
        except Exception as e:
            raise RuntimeError(
                f"Failed to load LoRA adapter from '{adapter_path}': {e}\n"
                f"Aborting to avoid running un-adapted model."
            )
    else:
        print("[3/3] Running Base Model without adapter.")

    model.eval()
    mem = get_vram_status()
    print(f"\n✅ Ready! GPU VRAM Allocated: {mem['allocated_gb']} GB / {mem['total_gb']} GB")
    return model, tokenizer, is_fine_tuned

def generate_response(
    model: Any,
    tokenizer: Any,
    messages: List[Dict[str, str]],
    temperature: float = 0.3,
    top_p: float = 0.9,
    max_new_tokens: int = 512,
    repetition_penalty: float = 1.15,
    stream: bool = True
) -> str:
    """Formats messages with chat template and generates response with optional streaming."""
    from transformers import TextStreamer

    chat_prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(chat_prompt, return_tensors="pt").to("cuda" if torch.cuda.is_available() else "cpu")

    streamer = TextStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True) if stream else None

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            streamer=streamer,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
            repetition_penalty=repetition_penalty,
            do_sample=True if temperature > 0 else False,
            pad_token_id=tokenizer.pad_token_id
        )

    response_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
    full_response = tokenizer.decode(response_tokens, skip_special_tokens=True).strip()
    return full_response

def run_interactive_cli(
    model: Any,
    tokenizer: Any,
    is_fine_tuned: bool,
    adapter_path: Optional[str] = None,
    temperature: float = 0.3,
    top_p: float = 0.9,
    max_new_tokens: int = 512,
    repetition_penalty: float = 1.15,
    max_history_turns: int = 8
):
    """Runs the interactive terminal chat loop."""
    manager = ConversationManager(max_history_turns=max_history_turns)

    print("\n" + "=" * 65)
    print(" 🌸 JAPANESE AI TUTOR (Sensei CLI) - INTERACTIVE SESSION")
    print(f" Status:  {'✅ Active Fine-Tuned LoRA Adapter' if is_fine_tuned else '⚠️ Base Model (No Adapter)'}")
    if is_fine_tuned:
        print(f" Adapter: {adapter_path}")
    print(" Commands: /clear (reset conversation), /status (VRAM), /history, /help, exit")
    print(" Tips:    Ask questions in English or Japanese, ask for sentence corrections,")
    print("          practice JLPT, or ask general questions!")
    print("=" * 65 + "\n")

    while True:
        try:
            user_input = input("🧑 You: ").strip()

            if not user_input:
                continue

            # Command handling
            if user_input.lower() in ["exit", "quit", "q"]:
                print("\nSensei: またね！(Mata ne! / See you later!) Happy Japanese studying! 🌸\n")
                break

            elif user_input == "/clear":
                manager.clear()
                print("🧹 Conversation context cleared.\n")
                continue

            elif user_input == "/status":
                mem = get_vram_status()
                print(f"📊 Status: Model in 4-bit | LoRA: {'Active' if is_fine_tuned else 'None'}")
                print(f"   VRAM: {mem['allocated_gb']} GB allocated | {mem['total_gb']} GB total")
                print(f"   History turns: {len(manager.turns) // 2} active\n")
                continue

            elif user_input == "/history":
                print(f"📜 Current conversation has {len(manager.turns) // 2} dialog turns:")
                for idx, t in enumerate(manager.turns, 1):
                    role_icon = "🧑" if t["role"] == "user" else "🤖"
                    print(f"  {idx}. {role_icon} {t['role'].capitalize()}: {t['content'][:80]}...")
                print()
                continue

            elif user_input == "/help":
                print("💡 Japanese AI Tutor Help:")
                print("  • Type any question in English or Japanese.")
                print("  • For sentence corrections: 'Is this natural: 昨日、デパートへ行きましたから...'")
                print("  • For grammar: 'Difference between は and が' or 'Explain 〜たら vs 〜ば'")
                print("  • For translation: 'How do I say X politely in business Japanese?'")
                print("  • General QA: 'Explain quantum computing' or 'What is photosynthesis?'")
                print("  • Commands: /clear, /status, /history, /help, exit\n")
                continue

            # Add turn and generate response
            manager.add_user_turn(user_input)

            print("\n🤖 Sensei: ", end="", flush=True)
            response = generate_response(
                model=model,
                tokenizer=tokenizer,
                messages=manager.get_messages(),
                temperature=temperature,
                top_p=top_p,
                max_new_tokens=max_new_tokens,
                repetition_penalty=repetition_penalty,
                stream=True
            )
            print("\n")

            manager.add_assistant_turn(response)

        except KeyboardInterrupt:
            print("\n\nSession interrupted. またね！\n")
            break
        except Exception as e:
            print(f"\n❌ Generation error: {e}\n")

def main():
    parser = argparse.ArgumentParser(description="Japanese AI Tutor Terminal Chat Application")
    parser.add_argument("--model", type=str, default=DEFAULT_BASE_MODEL, help="Base Hugging Face model ID")
    parser.add_argument("--adapter", type=str, default=DEFAULT_ADAPTER_DIR, help="Path to LoRA adapter directory")
    parser.add_argument("--no-adapter", action="store_true", help="Force running base model without adapter")
    parser.add_argument("--query", "-q", type=str, default=None, help="Execute single query and exit (non-interactive)")
    parser.add_argument("--temperature", type=float, default=0.3, help="Sampling temperature (default: 0.3)")
    parser.add_argument("--top-p", type=float, default=0.9, help="Top-p nucleus sampling (default: 0.9)")
    parser.add_argument("--max-tokens", type=int, default=512, help="Max new tokens to generate (default: 512)")
    parser.add_argument("--repetition-penalty", type=float, default=1.15, help="Repetition penalty (default: 1.15)")
    parser.add_argument("--max-history", type=int, default=8, help="Max conversational turns to retain (default: 8)")
    parser.add_argument("--quant", type=str, default="4bit", choices=["4bit", "none"], help="Quantization mode")
    args = parser.parse_args()

    adapter_target = None if args.no_adapter else args.adapter

    try:
        model, tokenizer, is_fine_tuned = load_tutor_model(
            base_model_id=args.model,
            adapter_path=adapter_target,
            quant=args.quant
        )
    except Exception as e:
        print(f"\n❌ Startup Error: {e}", file=sys.stderr)
        sys.exit(1)

    if args.query:
        # Non-interactive single query mode
        print(f"🧑 User: {args.query}\n")
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": args.query}
        ]
        print("🤖 Sensei: ", end="", flush=True)
        response = generate_response(
            model=model,
            tokenizer=tokenizer,
            messages=messages,
            temperature=args.temperature,
            top_p=args.top_p,
            max_new_tokens=args.max_tokens,
            repetition_penalty=args.repetition_penalty,
            stream=True
        )
        print("\n")
    else:
        # Interactive chat mode
        run_interactive_cli(
            model=model,
            tokenizer=tokenizer,
            is_fine_tuned=is_fine_tuned,
            adapter_path=adapter_target,
            temperature=args.temperature,
            top_p=args.top_p,
            max_new_tokens=args.max_tokens,
            repetition_penalty=args.repetition_penalty,
            max_history_turns=args.max_history
        )

if __name__ == "__main__":
    main()
