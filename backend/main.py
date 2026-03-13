from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import base64
from encrypt import generate_key, encrypt_image, decrypt_image
import io

app = FastAPI(title="Secure ID Shield Backend", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
allow_origins=["http://localhost:5173", "http://localhost:8080"],  # Vite dev ports
    allow_origin_regex="http://localhost:\\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Secure ID Shield Python Backend - Image AES Encryption/Decryption"}

@app.post("/encrypt/")
async def encrypt_endpoint(file: UploadFile = File(..., description="Image file (PNG/JPG)")):
    """Upload image → generate key → encrypt → return data + key."""
    if not file.content_type.startswith('image/'):
        raise HTTPException(400, "Only image files allowed")
    
    data = await file.read()
    key_b64 = generate_key()
    ciphertext, nonce, tag = encrypt_image(data, key_b64)
    
    return {
        "key": key_b64,
        "encrypted_data": base64.b64encode(ciphertext).decode('utf-8'),
        "nonce": base64.b64encode(nonce).decode('utf-8'),
        "tag": base64.b64encode(tag).decode('utf-8'),
        "original_filename": file.filename,
        "encrypted_filename": f"{file.filename.rsplit('.',1)[0]}_encrypted.bin"
    }

@app.post("/decrypt/")
async def decrypt_endpoint(
    file: UploadFile = File(..., description="Encrypted image file"),
    key: str = Form(..., description="Base64 AES key"),
    nonce: str = Form(..., description="Base64 nonce"),
    tag: str = Form(..., description="Base64 tag")
):
    """Decrypt encrypted image with key/nonce/tag."""
    try:
        data = await file.read()
        ciphertext = base64.b64decode(data) if data.startswith(b'iVBOR') else data  # Handle if base64 sent
        nonce_b = base64.b64decode(nonce)
        tag_b = base64.b64decode(tag)
        decrypted = decrypt_image(ciphertext, key, nonce_b, tag_b)
        
        return StreamingResponse(
            io.BytesIO(decrypted),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={file.filename.rsplit('.',1)[0]}_decrypted.png"}
        )
    except Exception as e:
        raise HTTPException(400, f"Decryption failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

