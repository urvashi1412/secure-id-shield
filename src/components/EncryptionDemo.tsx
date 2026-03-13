import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, RotateCcw } from "lucide-react";

type DemoState = "original" | "detected" | "encrypted" | "decrypted";

const backendBase = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

const EncryptionDemo = () => {
  const [state, setState] = useState<DemoState>("original");
  const [file, setFile] = useState<File | null>(null);
  const [encryptedFile, setEncryptedFile] = useState<File | null>(null);
  const [encryptedFileUrl, setEncryptedFileUrl] = useState<string>("");
  const [decryptFile, setDecryptFile] = useState<File | null>(null);
  const [nonce, setNonce] = useState<string>("");
  const [tag, setTag] = useState<string>("");
  const [key, setKey] = useState<string>("");
  const [encryptedBase64, setEncryptedBase64] = useState<string>("");
  const [encryptedImageUrl, setEncryptedImageUrl] = useState<string>("");
  const [decryptedUrl, setDecryptedUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFile = Boolean(file);
  const hasEncrypted = Boolean(encryptedBase64 || encryptedFile || decryptFile);
  const canEncrypt = hasFile && state === "original";
  const canDecrypt = hasEncrypted && state === "encrypted" && key && nonce && tag;

  const stateConfig = {
    original: {
      label: "ORIGINAL",
      color: "text-muted-foreground",
      regions: false,
      encrypted: false,
    },
    detected: {
      label: "REGIONS DETECTED",
      color: "text-primary",
      regions: true,
      encrypted: false,
    },
    encrypted: {
      label: "ENCRYPTED",
      color: "text-destructive",
      regions: true,
      encrypted: true,
    },
    decrypted: {
      label: "DECRYPTED",
      color: "text-primary",
      regions: false,
      encrypted: false,
    },
  };

  const current = stateConfig[state];

  const reset = () => {
    setState("original");
    setFile(null);
    setEncryptedFile(null);
    setEncryptedFileUrl("");
    setDecryptFile(null);
    setNonce("");
    setTag("");
    setKey("");
    setEncryptedBase64("");
    setEncryptedImageUrl("");
    setDecryptedUrl("");
    setError(null);
    localStorage.removeItem("siesh-encrypted");
    localStorage.removeItem("siesh-nonce");
    localStorage.removeItem("siesh-tag");
    localStorage.removeItem("siesh-key");
  };

  const formatKeyDisplay = useMemo(() => {
    if (!key) return "";
    return key.replace(/(.{8})/g, "$1-").slice(0, -1);
  }, [key]);

  useEffect(() => {
    const stored = localStorage.getItem("siesh-encrypted");
    const storedKey = localStorage.getItem("siesh-key");
    const storedNonce = localStorage.getItem("siesh-nonce");
    const storedTag = localStorage.getItem("siesh-tag");

    if (stored && storedKey && storedNonce && storedTag) {
      setEncryptedBase64(stored);
      setKey(storedKey);
      setNonce(storedNonce);
      setTag(storedTag);
      setState("encrypted");

      try {
        const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        setEncryptedFileUrl(url);
        setEncryptedFile(new File([blob], "encrypted.bin", { type: "application/octet-stream" }));
      } catch {
        // ignore if stored value is not valid base64
      }
    }
  }, []);

  useEffect(() => {
    if (encryptedBase64 && key && nonce && tag) {
      localStorage.setItem("siesh-encrypted", encryptedBase64);
      localStorage.setItem("siesh-key", key);
      localStorage.setItem("siesh-nonce", nonce);
      localStorage.setItem("siesh-tag", tag);
    }
  }, [encryptedBase64, key, nonce, tag]);

  useEffect(() => {
    if (!encryptedBase64) {
      setEncryptedImageUrl("");
      return;
    }

    try {
      const bytes = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
      const size = Math.ceil(Math.sqrt(bytes.length / 3));
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imageData = ctx.createImageData(size, size);
      const data = imageData.data;
      for (let i = 0; i < size * size; i += 1) {
        const byteIdx = i * 3;
        data[i * 4 + 0] = bytes[byteIdx] ?? 0;
        data[i * 4 + 1] = bytes[byteIdx + 1] ?? 0;
        data[i * 4 + 2] = bytes[byteIdx + 2] ?? 0;
        data[i * 4 + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
      setEncryptedImageUrl(canvas.toDataURL());
    } catch {
      setEncryptedImageUrl("");
    }
  }, [encryptedBase64]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setError(`${label} copied to clipboard`);
      window.setTimeout(() => setError(null), 2000);
    } catch (e) {
      setError(`Copy failed: ${(e as Error).message}`);
    }
  };

  const encrypt = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${backendBase}/encrypt/`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`Encryption failed (${res.status})`);

      const json = await res.json();
      setKey(json.key);
      setNonce(json.nonce);
      setTag(json.tag);
      setEncryptedBase64(json.encrypted_data);

      try {
        const bytes = Uint8Array.from(atob(json.encrypted_data), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        setEncryptedFileUrl(url);
        setEncryptedFile(new File([blob], `${file.name.replace(/\.[^/.]+$/, "")}_encrypted.bin`, { type: "application/octet-stream" }));
      } catch {
        setEncryptedFile(null);
        setEncryptedFileUrl("");
      }

      setState("encrypted");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const decrypt = async () => {
    if (!encryptedBase64 && !decryptFile) return;
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      const fileToSend = decryptFile ?? encryptedFile;
      if (!fileToSend) throw new Error("No encrypted file available for decryption");

      form.append("file", fileToSend);
      form.append("key", key);
      form.append("nonce", nonce);
      form.append("tag", tag);

      const res = await fetch(`${backendBase}/decrypt/`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`Decryption failed (${res.status})`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDecryptedUrl(url);
      setState("decrypted");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative py-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <span className="text-primary font-mono text-xs tracking-widest uppercase">Interactive</span>
          <h2 className="text-3xl md:text-4xl font-bold font-display">
            Encryption <span className="text-gradient">Demo</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            See how selective encryption works on a simulated government ID.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Simulated ID Card */}
          <div className="bg-glass rounded-2xl p-8 space-y-6">
            {/* Status bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${state === 'encrypted' ? 'bg-destructive' : 'bg-primary'} animate-pulse-glow`} />
                <span className={`font-mono text-xs tracking-widest ${current.color}`}>{current.label}</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground/50">SIE v1.0</span>
            </div>

            {/* Simulated ID */}
            <div className="bg-secondary/50 rounded-xl p-6 border border-border relative overflow-hidden">
              <div className="grid grid-cols-3 gap-4">
                {/* Photo area */}
                <div className="relative">
                  <div className={`w-full aspect-square rounded-lg transition-all duration-500 ${
                    current.encrypted 
                      ? 'bg-destructive/20 border-destructive/50' 
                      : 'bg-muted border-border'
                  } border-2 ${current.regions && !current.encrypted ? 'border-primary border-dashed' : ''} flex items-center justify-center`}>
                    {current.encrypted ? (
                      <div className="text-center space-y-1">
                        <Lock className="w-6 h-6 text-destructive mx-auto" />
                        <div className="font-mono text-xs text-destructive">ENCRYPTED</div>
                      </div>
                    ) : (
                      <div className="text-center space-y-1">
                        <div className="w-8 h-8 rounded-full bg-muted-foreground/20 mx-auto" />
                        <div className="font-mono text-xs text-muted-foreground">Photo</div>
                      </div>
                    )}
                  </div>
                  {current.regions && !current.encrypted && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-primary-foreground text-xs font-bold">!</span>
                    </div>
                  )}
                </div>

                {/* Info area */}
                <div className="col-span-2 space-y-3">
                  {/* Name - sensitive */}
                  <div className={`h-4 rounded transition-all duration-500 ${
                    current.encrypted 
                      ? 'bg-destructive/30 glow-primary' 
                      : current.regions 
                        ? 'bg-primary/20 border border-primary/40 border-dashed' 
                        : 'bg-muted-foreground/20'
                  }`} style={{ width: '70%' }} />
                  
                  {/* ID Number - sensitive */}
                  <div className={`h-4 rounded transition-all duration-500 ${
                    current.encrypted 
                      ? 'bg-destructive/30' 
                      : current.regions 
                        ? 'bg-primary/20 border border-primary/40 border-dashed' 
                        : 'bg-muted-foreground/20'
                  }`} style={{ width: '50%' }} />

                  {/* Non-sensitive fields */}
                  <div className="h-4 rounded bg-muted-foreground/10" style={{ width: '60%' }} />
                  <div className="h-4 rounded bg-muted-foreground/10" style={{ width: '40%' }} />
                  <div className="h-4 rounded bg-muted-foreground/10" style={{ width: '55%' }} />
                </div>
              </div>

              {/* Header - non-sensitive */}
              <div className="mt-4 pt-3 border-t border-border/50">
                <div className="h-3 rounded bg-muted-foreground/10 w-1/3" />
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-muted-foreground/20 border border-border" />
                <span className="text-muted-foreground">Non-sensitive</span>
              </div>
              {current.regions && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded border-2 border-dashed border-primary bg-primary/10" />
                  <span className="text-primary">Detected Region</span>
                </div>
              )}
              {current.encrypted && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-destructive/30" />
                  <span className="text-destructive">Encrypted</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3">
              <input
                type="file"
                accept="image/*"
                className="file-input"
                disabled={loading}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f) {
                    setState("original");
                    setError(null);
                    setDecryptedUrl("");
                  }
                }}
              />

              {encryptedFileUrl && (
                <div className="space-y-2">
                  <a
                    className="text-xs text-primary underline"
                    href={encryptedFileUrl}
                    download="encrypted.bin"
                  >
                    Download encrypted file
                  </a>

                  {encryptedBase64 && state === "encrypted" && (
                    <div className="space-y-1">
                      <div className="text-xs font-mono text-muted-foreground">Encrypted payload (base64)</div>
                      <div className="relative">
                        <textarea
                          readOnly
                          value={encryptedBase64}
                          className="w-full resize-none rounded border border-border bg-background/50 p-2 text-xs font-mono text-primary"
                          rows={3}
                        />
                        <button
                          type="button"
                          className="absolute top-1 right-1 text-xs text-primary underline"
                          onClick={() => copyToClipboard(encryptedBase64, "Encrypted payload")}
                        >
                          copy
                        </button>
                      </div>

                      {encryptedImageUrl && (
                        <div className="space-y-1">
                          <div className="text-xs font-mono text-muted-foreground">Encrypted data preview</div>
                          <img
                            src={encryptedImageUrl}
                            alt="Encrypted byte visualization"
                            className="max-w-full rounded-lg border border-border"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-mono text-muted-foreground">Or upload encrypted file (to decrypt)</label>
                <input
                  type="file"
                  accept="image/*,.bin"
                  className="file-input"
                  disabled={loading}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setDecryptFile(f);
                    if (f) {
                      setState("encrypted");
                      setError(null);
                    }
                  }}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="cyber"
                  onClick={encrypt}
                  className="flex-1"
                  disabled={!canEncrypt || loading}
                >
                  <Lock className="w-4 h-4 mr-2" /> Encrypt Image
                </Button>
                <Button
                  variant="cyber"
                  onClick={decrypt}
                  className="flex-1"
                  disabled={!canDecrypt || loading}
                >
                  <Unlock className="w-4 h-4 mr-2" /> Decrypt Image
                </Button>
              </div>

              {state === "decrypted" && decryptedUrl && (
                <div className="flex flex-col gap-2">
                  <a
                    className="text-xs text-primary underline"
                    href={decryptedUrl}
                    download="decrypted.png"
                  >
                    Download decrypted image
                  </a>
                  <img
                    src={decryptedUrl}
                    alt="Decrypted preview"
                    className="max-w-full rounded-lg border border-border"
                  />
                </div>
              )}

              {error && (
                <div className="text-xs text-destructive font-mono">Error: {error}</div>
              )}
              {(state === "encrypted" || state === "decrypted") && (
                <div className="bg-background/50 rounded-lg p-3 border border-border">
                  <div className="font-mono text-xs text-muted-foreground mb-1">UNIQUE IMAGE KEY (base64)</div>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs text-primary break-all">
                      {formatKeyDisplay || "(generated on encrypt)"}
                    </div>
                    {key && (
                      <button
                        type="button"
                        className="text-xs text-primary underline"
                        onClick={() => copyToClipboard(key, "Key")}
                      >
                        copy
                      </button>
                    )}
                  </div>
                </div>
              )}

              {loading && (
                <div className="text-xs text-muted-foreground font-mono">Working…</div>
              )}

              {state === "decrypted" && (
                <Button variant="cyber" onClick={reset} className="flex-1">
                  <RotateCcw className="w-4 h-4 mr-2" /> Reset Demo
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EncryptionDemo;

