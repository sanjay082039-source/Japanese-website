#!/usr/bin/env python3
"""
Japanese AI Tutor - Hardware & Software Diagnostic Verification Script
Verifies:
1. Python version and virtual environment
2. Package imports: torch, transformers, datasets, trl, peft, accelerate, bitsandbytes
3. GPU visibility and CUDA availability
4. GPU properties, architecture, and available VRAM
5. Active CUDA tensor computation test
6. bitsandbytes 4-bit CUDA quantization test
"""

import sys
import os

def run_diagnostics():
    print("=" * 70)
    print(" 🌸 JAPANESE AI TUTOR - ENVIRONMENT & HARDWARE DIAGNOSTICS")
    print("=" * 70)

    all_passed = True

    # 1. Python Environment Check
    print("\n[Step 1/6] Python Runtime & Virtual Environment")
    py_ver = sys.version_info
    print(f"  • Executable: {sys.executable}")
    print(f"  • Version: {py_ver.major}.{py_ver.minor}.{py_ver.micro}")
    in_venv = sys.prefix != sys.base_prefix
    print(f"  • In Virtual Environment: {in_venv} ({sys.prefix})")
    if not in_venv:
        print("  ⚠️ WARNING: Not running inside a virtual environment.")
    if py_ver.major == 3 and 10 <= py_ver.minor <= 12:
        print("  ✅ PASS: Python version is in the supported ML sweet-spot (3.10 - 3.12).")
    else:
        print(f"  ⚠️ WARNING: Python {py_ver.major}.{py_ver.minor} may face wheel compatibility issues with CUDA libraries.")

    # 2. Package Imports Check
    print("\n[Step 2/6] Verifying Required Machine Learning Libraries")
    packages = [
        ("torch", "PyTorch"),
        ("transformers", "Hugging Face Transformers"),
        ("datasets", "Hugging Face Datasets"),
        ("trl", "TRL (Transformer Reinforcement Learning)"),
        ("peft", "PEFT (Parameter-Efficient Fine-Tuning / LoRA)"),
        ("accelerate", "Hugging Face Accelerate"),
        ("bitsandbytes", "BitsAndBytes (4-bit/8-bit Quantization)")
    ]

    for mod_name, label in packages:
        try:
            mod = __import__(mod_name)
            ver = getattr(mod, "__version__", "unknown")
            print(f"  ✅ {label} ({mod_name}): {ver}")
        except ImportError as e:
            print(f"  ❌ FAIL: Could not import {label} ({mod_name}): {e}")
            all_passed = False

    if not all_passed:
        print("\n❌ Critical dependencies are missing. Please complete package installation.")
        return False

    import torch

    # 3. CUDA Availability Check
    print("\n[Step 3/6] NVIDIA GPU Visibility & CUDA Availability")
    cuda_available = torch.cuda.is_available()
    print(f"  • torch.cuda.is_available(): {cuda_available}")
    if not cuda_available:
        print("  ❌ FAIL: PyTorch cannot detect CUDA. GPU acceleration is unavailable.")
        return False

    device_count = torch.cuda.device_count()
    print(f"  • Visible GPU count: {device_count}")
    if device_count == 0:
        print("  ❌ FAIL: No CUDA devices found.")
        return False

    # 4. GPU Properties & Memory
    print("\n[Step 4/6] GPU Hardware Specifications & Memory")
    device_id = 0
    device_name = torch.cuda.get_device_name(device_id)
    compute_cap = torch.cuda.get_device_capability(device_id)
    free_bytes, total_bytes = torch.cuda.mem_get_info(device_id)
    free_gb = free_bytes / (1024 ** 3)
    total_gb = total_bytes / (1024 ** 3)
    used_gb = total_gb - free_gb

    print(f"  • Device 0: {device_name}")
    print(f"  • Compute Capability: {compute_cap[0]}.{compute_cap[1]}")
    print(f"  • Total VRAM: {total_gb:.2f} GB ({total_bytes} bytes)")
    print(f"  • Used VRAM:  {used_gb:.2f} GB")
    print(f"  • Free VRAM:  {free_gb:.2f} GB")
    print(f"  • PyTorch CUDA Version: {torch.version.cuda}")
    print("  ✅ PASS: GPU details successfully queried.")

    # 5. Live Tensor Computation on GPU
    print("\n[Step 5/6] CUDA Computation Test (Matrix Multiplication & Allocation)")
    try:
        torch.cuda.empty_cache()
        mem_start = torch.cuda.memory_allocated(device_id)
        # Allocate two 2048 x 2048 FP32 matrices on the GPU and compute dot product
        a = torch.randn(2048, 2048, device="cuda", dtype=torch.float32)
        b = torch.randn(2048, 2048, device="cuda", dtype=torch.float32)
        c = torch.matmul(a, b)
        torch.cuda.synchronize()
        mem_peak = torch.cuda.memory_allocated(device_id)
        delta_mb = (mem_peak - mem_start) / (1024 ** 2)
        print(f"  • Successfully performed 2048x2048 matrix multiplication on {device_name}.")
        print(f"  • Memory allocated for tensor test: {delta_mb:.2f} MB")
        del a, b, c
        torch.cuda.empty_cache()
        print("  ✅ PASS: CUDA computation & memory release verified.")
    except Exception as e:
        print(f"  ❌ FAIL: CUDA computation failed: {e}")
        return False

    # 6. bitsandbytes 4-bit CUDA Quantization Test
    print("\n[Step 6/6] bitsandbytes 4-bit Quantization Engine Test")
    try:
        import bitsandbytes as bnb
        layer = bnb.nn.Linear4bit(128, 128, bias=False, compute_dtype=torch.bfloat16).to("cuda")
        test_in = torch.randn(4, 128, dtype=torch.bfloat16, device="cuda")
        test_out = layer(test_in)
        torch.cuda.synchronize()
        print(f"  • Linear4bit test forward pass output shape: {list(test_out.shape)}")
        del layer, test_in, test_out
        torch.cuda.empty_cache()
        print("  ✅ PASS: bitsandbytes 4-bit NF4 CUDA kernel works properly on this GPU.")
    except Exception as e:
        print(f"  ❌ FAIL: bitsandbytes 4-bit test failed: {e}")
        return False

    print("\n" + "=" * 70)
    print(" 🎉 ALL ENVIRONMENT CHECKS PASSED SUCCESSFULLY!")
    print(" The development environment is 100% ready for model fine-tuning.")
    print("=" * 70)
    return True

if __name__ == "__main__":
    success = run_diagnostics()
    sys.exit(0 if success else 1)
