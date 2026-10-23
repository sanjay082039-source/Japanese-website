"""
Voice Pipeline Exceptions for Japanese AI Tutor.
Provides structured, informative error classes for handling unsupported audio formats,
silent or noisy recordings, missing models, and unavailable resources.
"""

class VoiceError(Exception):
    """Base exception for all voice pipeline errors."""
    pass

class EmptyAudioError(VoiceError):
    """Raised when provided audio buffer or file contains zero bytes or no signal."""
    pass

class NoSpeechDetectedError(VoiceError):
    """Raised when audio was recorded but no speech or decipherable words were detected."""
    pass

class UnsupportedAudioFormatError(VoiceError):
    """Raised when the audio format/codec cannot be decoded by the speech recognizer."""
    pass

class STTResourceUnavailableError(VoiceError):
    """Raised when speech recognition model or library failed to load or initialize."""
    pass

class TTSUnavailableError(VoiceError):
    """Raised when text-to-speech synthesis fails or network service is unreachable."""
    pass

class LLMUnavailableError(VoiceError):
    """Raised when the underlying tutor LLM is not loaded or encounters an error."""
    pass
