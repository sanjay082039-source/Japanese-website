"""
Japanese AI Tutor - Automated Benchmark & Evaluation Suite
Tests model on 4 core competencies:
1. Grammar Explanation (Particles, Conjugation, Keigo)
2. Sentence Correction & Feedback
3. JLPT Multiple Choice & Reasoning (N5 - N2)
4. Conversational Fluency & Roleplay
"""

import os
import sys
import argparse
import json
import torch

BENCHMARK_PROMPTS = [
    {
        "category": "Grammar Explanation",
        "prompt": "Explain the difference between に (ni) and で (de) when describing locations in Japanese."
    },
    {
        "category": "Sentence Correction",
        "prompt": "Please correct and explain this sentence: 「私は日本に旅行をしたことがあります。寿司をたくさん食べましたので、とても楽しかった。」"
    },
    {
        "category": "JLPT Practice",
        "prompt": "JLPT N4 Question: 「毎朝、7時（　）起きます。」 Which particle is correct: に, で, を, or が? Explain why."
    },
    {
        "category": "Conversational Fluency",
        "prompt": "こんにちは！東京でおすすめの観光スポットを教えてください。理由も一緒に説明してほしいです。"
    }
]

def run_evaluation(base_model_id: str = "Qwen/Qwen2.5-3B-Instruct", adapter_path: str = None, output_file: str = "eval_results.json"):
    print("=" * 65)
    print(" Japanese AI Tutor - Automated Evaluation Suite")
    print("=" * 65)

    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from peft import PeftModel

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16
    )

    print(f"Loading Tokenizer & 4-bit Model: {base_model_id}...")
    tokenizer = AutoTokenizer.from_pretrained(base_model_id, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        base_model_id,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        trust_remote_code=True
    )

    if adapter_path and os.path.exists(adapter_path):
        print(f"Loading LoRA Adapter from: {adapter_path}...")
        model = PeftModel.from_pretrained(model, adapter_path)

    model.eval()
    results = []

    print("\nRunning benchmark prompts...")
    for idx, test in enumerate(BENCHMARK_PROMPTS, 1):
        category = test["category"]
        prompt = test["prompt"]
        print(f"\n[{idx}/{len(BENCHMARK_PROMPTS)}] Testing: {category}")
        print(f"  Prompt: {prompt}")

        messages = [
            {"role": "system", "content": "You are Sensei, a bilingual Japanese AI Tutor. Give helpful, accurate explanations with natural Japanese and clear English."},
            {"role": "user", "content": prompt}
        ]
        formatted = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(formatted, return_tensors="pt").to("cuda")

        with torch.no_grad():
            output_tokens = model.generate(
                **inputs,
                max_new_tokens=400,
                temperature=0.6,
                top_p=0.9,
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id
            )

        resp = tokenizer.decode(output_tokens[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
        print(f"  Response Preview:\n{resp[:200]}...\n")

        results.append({
            "category": category,
            "prompt": prompt,
            "response": resp
        })

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"✅ Evaluation complete! Full results saved to: {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, default="Qwen/Qwen2.5-3B-Instruct")
    parser.add_argument("--adapter", type=str, default=None)
    parser.add_argument("--output", type=str, default="eval_results.json")
    args = parser.parse_args()

    run_evaluation(args.model, args.adapter, args.output)
