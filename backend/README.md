# Secure ID Shield Python Backend

## Setup (Windows)
```bash
cd backend
python -m venv venv
venv\\Scripts\\activate
pip install -r requirements.txt
```

## Run
```bash
uvicorn main:app --reload --port 8000
```

## Test
- Open http://localhost:8000/docs
- POST /encrypt: Upload PNG/JPG → get JSON with key/nonce/tag/encrypted_base64
- POST /decrypt: Upload .bin encrypted + paste key/nonce/tag → download decrypted.png

## Integrate Frontend
In EncryptionDemo.tsx:
- Add `<input type="file" />`
- fetch('http://localhost:8000/encrypt', {method:'POST', body: formData})
- For decrypt similar + FormData with key/nonce/tag

