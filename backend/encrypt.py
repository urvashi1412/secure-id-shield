import os
import base64
from typing import Tuple
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes

def generate_key() -> str:
    """Generate random 256-bit AES key, return base64 encoded."""
    key = get_random_bytes(32)
    return base64.b64encode(key).decode('utf-8')

def encrypt_image(data: bytes, key_b64: str) -> Tuple[bytes, bytes, bytes]:
    """Encrypt image bytes with AES-GCM. Returns (ciphertext, nonce, tag)."""
    key = base64.b64decode(key_b64)
    nonce = get_random_bytes(12)  # GCM nonce
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(data)
    return ciphertext, nonce, tag

def decrypt_image(ciphertext: bytes, key_b64: str, nonce: bytes, tag: bytes) -> bytes:
    """Decrypt with AES-GCM. Raises ValueError on failure."""
    key = base64.b64decode(key_b64)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    try:
        return cipher.decrypt_and_verify(ciphertext, tag)
    except ValueError:
        raise ValueError("Decryption failed: invalid key, nonce, or tag")

