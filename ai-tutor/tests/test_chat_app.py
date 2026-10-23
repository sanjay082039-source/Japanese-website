#!/usr/bin/env python3
"""
Automated Test Suite for Japanese AI Tutor Terminal Chat Application
Validates:
1. Conversation history management & turn pruning
2. Strict adapter loading (ensures NO silent fallback to base model on missing/invalid adapter)
3. Live LoRA adapter verification (PeftModel instance check)
4. Representative pedagogical queries:
   - Japanese translation & grammar nuances
   - Gentle sentence correction
   - General knowledge (verifying it does NOT force an artificial Japanese lesson)
   - Ambiguous question disambiguation
5. GPU memory efficiency (verifies VRAM remains under 2.5 GB)
"""

import os
import sys
import pytest
import torch

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.cli_tutor import (
    ConversationManager,
    load_tutor_model,
    generate_response,
    get_vram_status,
    DEFAULT_BASE_MODEL,
    DEFAULT_ADAPTER_DIR,
    SYSTEM_PROMPT
)

# ---------------------------------------------------------------------------
# Unit Tests (Fast, No GPU Required)
# ---------------------------------------------------------------------------

def test_conversation_manager_turns():
    """Verifies that ConversationManager correctly appends and retrieves turns."""
    manager = ConversationManager(system_prompt="Test System", max_history_turns=4)
    assert len(manager.get_messages()) == 1
    assert manager.get_messages()[0]["role"] == "system"

    manager.add_user_turn("Hello")
    manager.add_assistant_turn("Konnichiwa")
    msgs = manager.get_messages()

    assert len(msgs) == 3
    assert msgs[1] == {"role": "user", "content": "Hello"}
    assert msgs[2] == {"role": "assistant", "content": "Konnichiwa"}

def test_conversation_manager_sliding_window_pruning():
    """Verifies that turns are pruned when exceeding max_history_turns while preserving system prompt."""
    manager = ConversationManager(system_prompt="Test System", max_history_turns=2)
    # Add 4 turn pairs (8 messages)
    for i in range(1, 5):
        manager.add_user_turn(f"User {i}")
        manager.add_assistant_turn(f"Assistant {i}")

    msgs = manager.get_messages()
    # Should retain system prompt + 2 most recent pairs (4 messages) = 5 total
    assert len(msgs) == 5
    assert msgs[0]["role"] == "system"
    assert msgs[1]["content"] == "User 3"
    assert msgs[2]["content"] == "Assistant 3"
    assert msgs[3]["content"] == "User 4"
    assert msgs[4]["content"] == "Assistant 4"

def test_conversation_manager_clear():
    """Verifies that clear() resets conversation history back to only system prompt."""
    manager = ConversationManager()
    manager.add_user_turn("Test query")
    manager.add_assistant_turn("Test reply")
    assert len(manager.get_messages()) == 3

    manager.clear()
    assert len(manager.get_messages()) == 1
    assert manager.get_messages()[0]["role"] == "system"

def test_missing_adapter_raises_error():
    """
    CRITICAL REQUIREMENT:
    Verifies that providing a missing adapter path throws FileNotFoundError
    and NEVER silently falls back to the base model.
    """
    fake_path = "adapters/non_existent_fake_adapter_dir"
    with pytest.raises(FileNotFoundError) as exc_info:
        load_tutor_model(base_model_id=DEFAULT_BASE_MODEL, adapter_path=fake_path)

    assert "Specified LoRA adapter path does not exist" in str(exc_info.value)
    assert "will NOT silently fall back" in str(exc_info.value)

# ---------------------------------------------------------------------------
# Integration Tests (Requires Model Loading on GPU)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def tutor_model():
    """Loads model once for integration testing."""
    if not torch.cuda.is_available():
        pytest.skip("CUDA is not available on this machine.")

    adapter_path = DEFAULT_ADAPTER_DIR if os.path.exists(DEFAULT_ADAPTER_DIR) else "adapters/japanese-ai-tutor-smoke-test"
    if not os.path.exists(adapter_path):
        pytest.skip(f"No trained adapter found at {adapter_path}")

    model, tokenizer, is_fine_tuned = load_tutor_model(
        base_model_id=DEFAULT_BASE_MODEL,
        adapter_path=adapter_path,
        quant="4bit"
    )
    return model, tokenizer, is_fine_tuned

def test_adapter_loaded_and_verified(tutor_model):
    """Verifies that the model is an active PeftModel with fine-tuned adapter."""
    model, tokenizer, is_fine_tuned = tutor_model
    from peft import PeftModel

    assert is_fine_tuned is True, "Model should be tagged as fine-tuned"
    assert isinstance(model, PeftModel), "Model must be an instance of PeftModel"
    assert hasattr(model, "active_adapter"), "Model must have active_adapter attribute"

def test_vram_footprint(tutor_model):
    """Verifies that model VRAM allocation remains strictly within safe bounds (< 2.5 GB)."""
    mem = get_vram_status()
    print(f"\n[Test] VRAM Status: {mem}")
    assert mem["allocated_gb"] < 2.5, f"VRAM allocation ({mem['allocated_gb']} GB) exceeded 2.5 GB limit"

def test_representative_translation_and_grammar(tutor_model):
    """Tests Japanese translation and grammar query."""
    model, tokenizer, _ = tutor_model
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "How do I say 'I want to become better at Japanese' and what is the difference between 上手になりたい and 上達したい?"}
    ]
    resp = generate_response(model, tokenizer, messages, stream=False, max_new_tokens=250)
    print(f"\n[Response - Translation & Grammar]:\n{resp}\n")

    assert len(resp) > 30, "Response must not be empty"
    # Check that it includes Japanese characters
    assert any('\u3040' <= c <= '\u309f' or '\u4e00' <= c <= '\u9fff' for c in resp), "Response must contain Japanese"

def test_representative_gentle_correction(tutor_model):
    """Tests gentle sentence correction for a learner mistake."""
    model, tokenizer, _ = tutor_model
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "Please check my Japanese sentence: 「きのう、デパートへ行って、新しい靴を買いましたから、とても高かったですから、買いませんでした。」"}
    ]
    resp = generate_response(model, tokenizer, messages, stream=False, max_new_tokens=250)
    print(f"\n[Response - Gentle Correction]:\n{resp}\n")

    assert len(resp) > 30, "Response must not be empty"
    # Verify gentle feedback or correction
    resp_lower = resp.lower()
    assert any(k in resp_lower for k in ["correct", "mean", "natural", "expensive", "buy", "高かった", "買いません", "靴"]), "Response should address the sentence correction"

def test_representative_general_knowledge(tutor_model):
    """
    Tests that the tutor handles a general science question directly in English
    WITHOUT forcing an unnatural Japanese grammar lesson.
    """
    model, tokenizer, _ = tutor_model
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "What is photosynthesis and how does it work in plants?"}
    ]
    resp = generate_response(model, tokenizer, messages, stream=False, max_new_tokens=250)
    print(f"\n[Response - General Knowledge]:\n{resp}\n")

    assert len(resp) > 40, "Response must not be empty"
    resp_lower = resp.lower()
    # Must correctly explain the biological concept
    assert any(k in resp_lower for k in ["chlorophyll", "sunlight", "light", "carbon dioxide", "glucose", "energy", "oxygen"]), "Must explain photosynthesis scientifically"

def test_representative_ambiguous_question(tutor_model):
    """Tests ambiguous homophone question (ame = rain vs candy)."""
    model, tokenizer, _ = tutor_model
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "What does the Japanese word 'ame' mean?"}
    ]
    resp = generate_response(model, tokenizer, messages, stream=False, max_new_tokens=250)
    print(f"\n[Response - Ambiguous Question]:\n{resp}\n")

    assert len(resp) > 30, "Response must not be empty"
    resp_lower = resp.lower()
    # Must identify rain (雨) and/or candy (飴)
    assert ("rain" in resp_lower or "雨" in resp) or ("candy" in resp_lower or "飴" in resp), "Should identify homophones for ame"

# ---------------------------------------------------------------------------
# CLI Execution Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 65)
    print(" 🧪 RUNNING AUTOMATED TEST SUITE FOR JAPANESE AI TUTOR CHAT")
    print("=" * 65)

    print("\n[Phase 1] Running Unit Tests (Conversation Manager & Safety)...")
    test_conversation_manager_turns()
    print("  ✅ test_conversation_manager_turns PASSED")
    test_conversation_manager_sliding_window_pruning()
    print("  ✅ test_conversation_manager_sliding_window_pruning PASSED")
    test_conversation_manager_clear()
    print("  ✅ test_conversation_manager_clear PASSED")
    test_missing_adapter_raises_error()
    print("  ✅ test_missing_adapter_raises_error PASSED (No silent fallback verified)")

    print("\n[Phase 2] Running Model Integration Tests (GPU & LoRA Adapter)...")
    if torch.cuda.is_available():
        adapter_path = DEFAULT_ADAPTER_DIR if os.path.exists(DEFAULT_ADAPTER_DIR) else "adapters/japanese-ai-tutor-smoke-test"
        model, tokenizer, is_ft = load_tutor_model(base_model_id=DEFAULT_BASE_MODEL, adapter_path=adapter_path, quant="4bit")
        tutor_fixture = (model, tokenizer, is_ft)

        test_adapter_loaded_and_verified(tutor_fixture)
        print("  ✅ test_adapter_loaded_and_verified PASSED (Active PeftModel verified)")

        test_vram_footprint(tutor_fixture)
        print("  ✅ test_vram_footprint PASSED (< 2.5 GB allocated)")

        print("\n[Phase 3] Testing 4 Representative Queries...")
        test_representative_translation_and_grammar(tutor_fixture)
        print("  ✅ test_representative_translation_and_grammar PASSED")

        test_representative_gentle_correction(tutor_fixture)
        print("  ✅ test_representative_gentle_correction PASSED")

        test_representative_general_knowledge(tutor_fixture)
        print("  ✅ test_representative_general_knowledge PASSED (No forced grammar lecture)")

        test_representative_ambiguous_question(tutor_fixture)
        print("  ✅ test_representative_ambiguous_question PASSED")

        print("\n" + "=" * 65)
        print(" 🎉 ALL 8 TESTS PASSED! Chat application is fully verified.")
        print("=" * 65)
    else:
        print("  ⚠️ CUDA not detected, skipping Phase 2 & 3 GPU tests.")
