"""
Model Loader and Hardware Memory Manager for Japanese AI Tutor
Provides:
- Robust model and tokenizer loading with 4-bit / 8-bit / bfloat16 quantization.
- Real-time NVIDIA GPU VRAM reporting.
- Graceful error handling for OOM, network/download failures, and authentication.
"""

import os
import sys
import yaml
import torch
from typing import Tuple, Dict, Any, Optional

def get_gpu_memory_report() -> Dict[str, Any]:
    """Queries and returns current CUDA device memory allocation and availability."""
    if not torch.cuda.is_available():
        return {
            "cuda_available": False,
            "device_name": "CPU",
            "allocated_gb": 0.0,
            "reserved_gb": 0.0,
            "free_gb": 0.0,
            "total_gb": 0.0,
            "summary": "CUDA is not available (running on CPU)."
        }

    device_id = torch.cuda.current_device()
    device_name = torch.cuda.get_device_name(device_id)
    free_bytes, total_bytes = torch.cuda.mem_get_info(device_id)
    allocated_bytes = torch.cuda.memory_allocated(device_id)
    reserved_bytes = torch.cuda.memory_reserved(device_id)

    allocated_gb = allocated_bytes / (1024 ** 3)
    reserved_gb = reserved_bytes / (1024 ** 3)
    free_gb = free_bytes / (1024 ** 3)
    total_gb = total_bytes / (1024 ** 3)

    summary = (
        f"GPU: {device_name} | VRAM Total: {total_gb:.2f} GB | "
        f"Allocated: {allocated_gb:.2f} GB | Reserved: {reserved_gb:.2f} GB | "
        f"Available Free: {free_gb:.2f} GB"
    )

    return {
        "cuda_available": True,
        "device_id": device_id,
        "device_name": device_name,
        "allocated_gb": allocated_gb,
        "reserved_gb": reserved_gb,
        "free_gb": free_gb,
        "total_gb": total_gb,
        "summary": summary
    }

def load_model_and_tokenizer(
    model_id: str,
    quantization_mode: str = "4bit",
    device_map: str = "auto",
    hf_token: Optional[str] = None
) -> Tuple[Any, Any]:
    """
    Loads Hugging Face model and tokenizer with error handling and memory optimization.
    
    Args:
        model_id: Hugging Face repo ID (e.g. 'Qwen/Qwen3-4B' or 'Qwen/Qwen2.5-3B-Instruct')
        quantization_mode: '4bit', '8bit', 'bf16', or 'cpu'
        device_map: 'auto' or 'cpu'
        hf_token: Optional Hugging Face token for gated models
    """
    print("=" * 70)
    print(f" 🚀 Loading Model: {model_id}")
    print(f" ⚙️  Quantization Mode: {quantization_mode} | Device Map: {device_map}")
    print("=" * 70)

    # Initial Memory Check
    initial_mem = get_gpu_memory_report()
    print(f"Pre-load Memory Status:\n  {initial_mem['summary']}")

    token = hf_token or os.environ.get("HF_TOKEN")

    # 1. Load Tokenizer
    try:
        from transformers import AutoTokenizer
        print("\n[1/2] Loading Tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(
            model_id,
            trust_remote_code=True,
            token=token
        )
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        print(f"  ✅ Tokenizer loaded successfully (Vocab size: {len(tokenizer):,})")
    except Exception as e:
        err_msg = str(e)
        if "401" in err_msg or "gated" in err_msg.lower():
            print(f"\n❌ Authentication Failure: Model '{model_id}' requires authentication.")
            print("   Please provide a valid Hugging Face token via `export HF_TOKEN=hf_...`")
        elif "404" in err_msg or "not found" in err_msg.lower():
            print(f"\n❌ Model Not Found: Repository '{model_id}' does not exist on Hugging Face.")
        else:
            print(f"\n❌ Failed to load tokenizer: {e}")
        raise

    # 2. Configure Quantization & Precision
    from transformers import AutoModelForCausalLM, BitsAndBytesConfig

    bnb_config = None
    torch_dtype = torch.bfloat16

    if quantization_mode == "4bit":
        if not torch.cuda.is_available():
            print("⚠️ Warning: CUDA unavailable, falling back from 4-bit to CPU float32.")
            device_map = "cpu"
            torch_dtype = torch.float32
        else:
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True,
                bnb_4bit_compute_dtype=torch.bfloat16
            )
    elif quantization_mode == "8bit":
        if not torch.cuda.is_available():
            device_map = "cpu"
            torch_dtype = torch.float32
        else:
            bnb_config = BitsAndBytesConfig(load_in_8bit=True)
    elif quantization_mode == "bf16":
        torch_dtype = torch.bfloat16
    elif quantization_mode == "cpu":
        device_map = "cpu"
        torch_dtype = torch.float32

    # 3. Load Model Weights
    try:
        print("\n[2/2] Loading Model Weights...")
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            quantization_config=bnb_config,
            dtype=torch_dtype,
            device_map=device_map,
            trust_remote_code=True,
            token=token
        )
        model.eval()

        post_mem = get_gpu_memory_report()
        print(f"  ✅ Model weights loaded successfully!")
        print(f"Post-load Memory Status:\n  {post_mem['summary']}")

        return model, tokenizer

    except torch.cuda.OutOfMemoryError as e:
        print(f"\n❌ CUDA Out Of Memory Error while loading '{model_id}'!")
        print(f"   Current VRAM: {get_gpu_memory_report()['summary']}")
        print("   💡 Recommendations:")
        print("     1. Ensure 4-bit quantization is enabled (quantization_mode='4bit').")
        print("     2. Switch to a smaller parameter candidate (e.g., 'Qwen/Qwen2.5-3B-Instruct' or '1.5B').")
        print("     3. Close other GPU processes to free memory.")
        torch.cuda.empty_cache()
        raise

    except Exception as e:
        err_msg = str(e)
        if "KeyError: 'qwen3'" in err_msg:
            print("\n❌ Version Incompatibility: Current `transformers` library does not recognize 'qwen3'.")
            print("   Please upgrade `transformers>=4.51.0` or select the battle-tested candidate `Qwen/Qwen2.5-3B-Instruct`.")
        elif "connection" in err_msg.lower() or "timeout" in err_msg.lower():
            print(f"\n❌ Network / Download Failure: Could not download weights for '{model_id}'.")
            print("   Check internet connectivity or Hugging Face server status.")
        else:
            print(f"\n❌ Failed to load model '{model_id}': {e}")
        raise

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Test model loading and VRAM report")
    parser.add_argument("--model", type=str, default="Qwen/Qwen2.5-3B-Instruct", help="Model repository ID")
    parser.add_argument("--quant", type=str, default="4bit", choices=["4bit", "8bit", "bf16", "cpu"])
    args = parser.parse_args()

    model, tokenizer = load_model_and_tokenizer(args.model, args.quant)
    print("\n🎉 Success: Model and Tokenizer loaded cleanly!")
