"""
Security and input sanitization layer for Japanese AI Tutor API.
Prevents path traversal, injection attacks, and enforces optional API authentication.
"""

import re
import hmac
from typing import Optional
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.api.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Patterns commonly associated with directory traversal or command injection
SUSPICIOUS_PATH_PATTERNS = [
    re.compile(r"\.\./"),               # ../ traversal
    re.compile(r"/\.\."),               # /.. traversal
    re.compile(r"(?:/etc/|/root/|/proc/|/sys/|/home/\w+/\.)"),  # System files
    re.compile(r"(?:;\s*(?:rm|bash|sh|curl|wget|chmod|cat)\b)"), # Command chaining
]

def sanitize_user_input(text: str) -> str:
    """
    Sanitizes user input:
    - Strips whitespace
    - Ensures non-executable plain text
    - Rejects path traversal or malicious command injection payloads
    """
    if not text:
        return ""

    cleaned = text.strip()

    # Check for direct file traversal or injection exploits
    for pattern in SUSPICIOUS_PATH_PATTERNS:
        if pattern.search(cleaned):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Request contains prohibited characters or suspicious directory/command sequences."
            )

    return cleaned


async def verify_api_key(api_key: Optional[str] = Security(api_key_header)) -> bool:
    """
    Optional API Key verification.
    If TUTOR_API_KEY is configured in settings, requests must supply a valid matching key.
    If no key is configured in settings, public access is permitted (local development mode).
    """
    configured_key = settings.api_key.strip()
    if not configured_key:
        # Authentication disabled in local mode
        return True

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required API key. Please provide 'X-API-Key' header.",
            headers={"WWW-Authenticate": "ApiKey"}
        )

    # Constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(api_key.strip(), configured_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key provided.",
        )

    return True
