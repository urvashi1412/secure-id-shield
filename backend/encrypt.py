import io
import base64
from typing import Tuple
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from PIL import Image


# ── Existing functions (unchanged) ──────────────────────────────────────────

def generate_key() -> str:
    """Generate random 256-bit AES key, return base64 encoded."""
    key = get_random_bytes(32)
    return base64.b64encode(key).decode('utf-8')


def encrypt_image(data: bytes, key_b64: str) -> Tuple[bytes, bytes, bytes]:
    """Encrypt image bytes with AES-GCM. Returns (ciphertext, nonce, tag)."""
    key = base64.b64decode(key_b64)
    nonce = get_random_bytes(12)
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


# ── Selective encryption (region-based) ─────────────────────────────────────

def encrypt_regions(image_bytes: bytes, regions: list[dict], key_b64: str) -> Tuple[bytes, list[dict]]:
    """
    Encrypt only specified regions of an image using AES-GCM.

    Each region dict must have: {"label": str, "x": int, "y": int, "w": int, "h": int}
    If regions list is empty, falls back to encrypting the full image as one region.

    Returns:
        output_image_bytes  – PNG image with sensitive regions replaced by noise pixels
        patches_meta        – list of per-region dicts containing nonce, tag, ciphertext,
                              and coordinates needed for decryption
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_w, img_h = img.size
    key = base64.b64decode(key_b64)
    patches_meta = []

    # If no regions provided, treat the entire image as one region
    if not regions:
        regions = [{"label": "full_image", "x": 0, "y": 0, "w": img_w, "h": img_h}]

    for region in regions:
        x = int(region["x"])
        y = int(region["y"])
        w = int(region["w"])
        h = int(region["h"])
        label = region.get("label", "region")

        # Clamp coordinates to image bounds
        x = max(0, min(x, img_w - 1))
        y = max(0, min(y, img_h - 1))
        w = max(1, min(w, img_w - x))
        h = max(1, min(h, img_h - y))

        # Crop the sensitive patch
        patch = img.crop((x, y, x + w, y + h))
        patch_bytes = patch.tobytes()  # raw RGB bytes, w*h*3 length

        # Encrypt the patch bytes
        nonce = get_random_bytes(12)
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        ciphertext, tag = cipher.encrypt_and_digest(patch_bytes)

        # Build a noise image from the ciphertext bytes to paste back
        # ciphertext is same length as patch_bytes (AES-GCM is a stream cipher)
        noise_img = Image.frombytes("RGB", (w, h), ciphertext)
        img.paste(noise_img, (x, y))

        patches_meta.append({
            "label": label,
            "x": x,
            "y": y,
            "w": w,
            "h": h,
            "nonce": base64.b64encode(nonce).decode(),
            "tag": base64.b64encode(tag).decode(),
            "ciphertext": base64.b64encode(ciphertext).decode(),
        })

    # Save the modified image (sensitive regions now show as noise)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue(), patches_meta


def decrypt_regions(image_bytes: bytes, patches_meta: list[dict], key_b64: str) -> bytes:
    """
    Restore encrypted regions in an image using stored patch metadata.

    patches_meta is the list returned by encrypt_regions (or the JSON-decoded
    equivalent sent from the frontend).

    Returns:
        PNG bytes of the fully restored image.
    Raises:
        ValueError if any patch fails AES-GCM authentication (wrong key/tag/nonce).
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    key = base64.b64decode(key_b64)

    for i, patch_info in enumerate(patches_meta):
        x = int(patch_info["x"])
        y = int(patch_info["y"])
        w = int(patch_info["w"])
        h = int(patch_info["h"])
        nonce = base64.b64decode(patch_info["nonce"])
        tag = base64.b64decode(patch_info["tag"])
        ciphertext = base64.b64decode(patch_info["ciphertext"])
        label = patch_info.get("label", f"region_{i}")

        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        try:
            patch_bytes = cipher.decrypt_and_verify(ciphertext, tag)
        except ValueError:
            raise ValueError(
                f"Decryption failed for region '{label}' at ({x},{y},{w},{h}): "
                "invalid key, nonce, or tag."
            )

        restored_patch = Image.frombytes("RGB", (w, h), patch_bytes)
        img.paste(restored_patch, (x, y))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def get_region_preview(image_bytes: bytes, patches_meta: list[dict]) -> bytes:
    """
    Draw visible red-bordered boxes over encrypted regions for UI preview.
    Does NOT decrypt — just overlays rectangles so the frontend can show
    which areas are protected.

    Returns PNG bytes with region outlines drawn on top.
    """
    from PIL import ImageDraw

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    draw = ImageDraw.Draw(img)

    for patch_info in patches_meta:
        x = int(patch_info["x"])
        y = int(patch_info["y"])
        w = int(patch_info["w"])
        h = int(patch_info["h"])
        label = patch_info.get("label", "")

        # Draw a 2px red border around each encrypted region
        draw.rectangle([x, y, x + w, y + h], outline=(220, 50, 50), width=2)

        # Draw label text above the box if it fits
        if label and y > 12:
            draw.text((x + 2, y - 12), label, fill=(220, 50, 50))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()