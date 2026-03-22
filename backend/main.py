import io
import base64
import json

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from encrypt import (
    generate_key,
    encrypt_image,
    decrypt_image,
    encrypt_regions,
    decrypt_regions,
    get_region_preview,
)
from detect import detect_sensitive_regions

app = FastAPI(title="Secure ID Shield Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # allow all origins during development
    allow_credentials=False,       # must be False when using allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "message": "Secure ID Shield Backend",
        "version": "2.0.0",
        "endpoints": [
            "POST /encrypt/",
            "POST /decrypt/",
            "POST /encrypt-selective/",
            "POST /decrypt-selective/",
            "POST /detect-regions/",
            "POST /region-preview/",
        ],
    }


# ── Original full-image encrypt / decrypt (kept for compatibility) ────────────

@app.post("/encrypt/")
async def encrypt_endpoint(
    file: UploadFile = File(..., description="Image file (PNG/JPG)"),
):
    """Upload image → generate key → encrypt whole image → return data + key."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are allowed")

    data = await file.read()
    key_b64 = generate_key()
    ciphertext, nonce, tag = encrypt_image(data, key_b64)

    return {
        "key": key_b64,
        "encrypted_data": base64.b64encode(ciphertext).decode(),
        "nonce": base64.b64encode(nonce).decode(),
        "tag": base64.b64encode(tag).decode(),
        "original_filename": file.filename,
        "encrypted_filename": f"{file.filename.rsplit('.', 1)[0]}_encrypted.bin",
    }


@app.post("/decrypt/")
async def decrypt_endpoint(
    file: UploadFile = File(..., description="Encrypted binary file"),
    key: str = Form(..., description="Base64 AES key"),
    nonce: str = Form(..., description="Base64 nonce"),
    tag: str = Form(..., description="Base64 tag"),
):
    """Decrypt a fully-encrypted image with key/nonce/tag."""
    try:
        data = await file.read()
        # Handle case where frontend accidentally sends base64 instead of raw bytes
        ciphertext = base64.b64decode(data) if data[:4] == b"iVBO" else data
        nonce_b = base64.b64decode(nonce)
        tag_b = base64.b64decode(tag)
        decrypted = decrypt_image(ciphertext, key, nonce_b, tag_b)

        stem = file.filename.rsplit(".", 1)[0] if file.filename else "decrypted"
        return StreamingResponse(
            io.BytesIO(decrypted),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={stem}_decrypted.png"},
        )
    except Exception as e:
        raise HTTPException(400, f"Decryption failed: {str(e)}")


# ── Selective (region-based) encrypt / decrypt ────────────────────────────────

@app.post("/encrypt-selective/")
async def encrypt_selective(
    file: UploadFile = File(..., description="Image file (PNG/JPG)"),
    regions: str = Form(
        default="[]",
        description=(
            'JSON array of regions. Each: {"label":"face","x":10,"y":20,"w":80,"h":100}. '
            "Pass [] to auto-detect sensitive regions."
        ),
    ),
):
    """
    Selectively encrypt sensitive regions of an ID image.

    - If regions is [] the backend auto-detects faces and text zones.
    - Non-sensitive areas remain readable in the output image.
    - Returns the modified PNG (base64), the AES key, and per-region patch metadata.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are allowed")

    data = await file.read()

    try:
        region_list = json.loads(regions)
    except json.JSONDecodeError:
        raise HTTPException(400, "regions must be a valid JSON array")

    if not isinstance(region_list, list):
        raise HTTPException(400, "regions must be a JSON array")

    # Auto-detect if caller passed an empty list
    if len(region_list) == 0:
        try:
            region_list = detect_sensitive_regions(data)
        except Exception as e:
            raise HTTPException(500, f"Region detection failed: {str(e)}")

    if not region_list:
        raise HTTPException(
            422,
            "No sensitive regions found. Pass explicit regions or use an image "
            "with a detectable face.",
        )

    key_b64 = generate_key()

    try:
        output_image_bytes, patches_meta = encrypt_regions(data, region_list, key_b64)
    except Exception as e:
        raise HTTPException(500, f"Encryption failed: {str(e)}")

    return {
        "key": key_b64,
        "patches": patches_meta,
        "image": base64.b64encode(output_image_bytes).decode(),
        "regions_encrypted": len(patches_meta),
        "original_filename": file.filename,
    }


@app.post("/decrypt-selective/")
async def decrypt_selective(
    file: UploadFile = File(..., description="Selectively-encrypted PNG image"),
    key: str = Form(..., description="Base64 AES key returned by /encrypt-selective/"),
    patches: str = Form(..., description="JSON patches array returned by /encrypt-selective/"),
):
    """
    Restore encrypted regions in an image using the key and patch metadata
    that were returned by /encrypt-selective/.
    """
    data = await file.read()

    try:
        patches_meta = json.loads(patches)
    except json.JSONDecodeError:
        raise HTTPException(400, "patches must be valid JSON")

    if not isinstance(patches_meta, list) or len(patches_meta) == 0:
        raise HTTPException(400, "patches must be a non-empty JSON array")

    try:
        restored = decrypt_regions(data, patches_meta, key)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Decryption failed: {str(e)}")

    stem = file.filename.rsplit(".", 1)[0] if file.filename else "restored"
    return StreamingResponse(
        io.BytesIO(restored),
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename={stem}_decrypted.png"},
    )


# ── Utility endpoints ─────────────────────────────────────────────────────────

@app.post("/detect-regions/")
async def detect_regions_endpoint(
    file: UploadFile = File(..., description="Image file to analyse"),
):
    """
    Run ML detection and return the bounding boxes without encrypting anything.
    Useful for previewing which regions will be encrypted before committing.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are allowed")

    data = await file.read()

    try:
        regions = detect_sensitive_regions(data)
    except Exception as e:
        raise HTTPException(500, f"Detection failed: {str(e)}")

    return {
        "regions": regions,
        "count": len(regions),
    }


@app.post("/region-preview/")
async def region_preview_endpoint(
    file: UploadFile = File(..., description="Selectively-encrypted PNG image"),
    patches: str = Form(..., description="JSON patches array from /encrypt-selective/"),
):
    """
    Draw red bounding-box outlines over encrypted regions without decrypting.
    Returns a PNG suitable for displaying in the frontend as a visual indicator.
    """
    data = await file.read()

    try:
        patches_meta = json.loads(patches)
    except json.JSONDecodeError:
        raise HTTPException(400, "patches must be valid JSON")

    try:
        preview_bytes = get_region_preview(data, patches_meta)
    except Exception as e:
        raise HTTPException(500, f"Preview generation failed: {str(e)}")

    return StreamingResponse(
        io.BytesIO(preview_bytes),
        media_type="image/png",
        headers={"Content-Disposition": "attachment; filename=preview.png"},
    )