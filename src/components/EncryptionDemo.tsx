import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, RotateCcw, ScanSearch } from "lucide-react";

type DemoState = "original" | "detected" | "encrypted" | "decrypted";
type EncryptMode = "full" | "selective";

interface Region {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PatchMeta extends Region {
  nonce: string;
  tag: string;
  ciphertext: string;
}

const backendBase = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

const EncryptionDemo = () => {
  const [state, setState] = useState<DemoState>("original");
  const [mode, setMode] = useState<EncryptMode>("selective");

  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>("");
  const [decryptFile, setDecryptFile] = useState<File | null>(null);

  const [encryptedFile, setEncryptedFile] = useState<File | null>(null);
  const [encryptedFileUrl, setEncryptedFileUrl] = useState<string>("");
  const [encryptedBase64, setEncryptedBase64] = useState<string>("");
  const [encryptedImageUrl, setEncryptedImageUrl] = useState<string>("");
  const [nonce, setNonce] = useState<string>("");
  const [tag, setTag] = useState<string>("");

  const [selectiveImageUrl, setSelectiveImageUrl] = useState<string>("");
  const [selectiveFile, setSelectiveFile] = useState<File | null>(null);
  const [patches, setPatches] = useState<PatchMeta[]>([]);
  const [detectedRegions, setDetectedRegions] = useState<Region[]>([]);

  const [key, setKey] = useState<string>("");
  const [decryptedUrl, setDecryptedUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Working…");
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [manualRegions, setManualRegions] = useState<Region[]>([]);
  const [showCanvas, setShowCanvas] = useState(false);

  const isSelective = mode === "selective";
  const hasFile = Boolean(file);
  const hasEncrypted = isSelective
    ? patches.length > 0
    : Boolean(encryptedBase64 || encryptedFile || decryptFile);
  const canEncrypt = hasFile && state === "original";
  const canDecrypt =
    hasEncrypted &&
    state === "encrypted" &&
    Boolean(key) &&
    (isSelective ? patches.length > 0 : Boolean(nonce && tag));

  const stateConfig = {
    original:  { label: "ORIGINAL",         color: "text-muted-foreground", regions: false, encrypted: false },
    detected:  { label: "REGIONS DETECTED", color: "text-primary",          regions: true,  encrypted: false },
    encrypted: { label: "ENCRYPTED",        color: "text-destructive",       regions: true,  encrypted: true  },
    decrypted: { label: "DECRYPTED",        color: "text-primary",           regions: false, encrypted: false },
  };
  const current = stateConfig[state];

  // ── localStorage ──────────────────────────────────────────────────────────

  useEffect(() => {
    const stored        = localStorage.getItem("siesh-encrypted");
    const storedKey     = localStorage.getItem("siesh-key");
    const storedNonce   = localStorage.getItem("siesh-nonce");
    const storedTag     = localStorage.getItem("siesh-tag");
    const storedPatches = localStorage.getItem("siesh-patches");
    const storedMode    = localStorage.getItem("siesh-mode") as EncryptMode | null;
    const storedSelImg  = localStorage.getItem("siesh-sel-image");

    if (storedMode) setMode(storedMode);

    if (storedMode === "selective" && storedKey && storedPatches && storedSelImg) {
      setKey(storedKey);
      setPatches(JSON.parse(storedPatches));
      setSelectiveImageUrl(storedSelImg);
      setState("encrypted");
    } else if (stored && storedKey && storedNonce && storedTag) {
      setEncryptedBase64(stored);
      setKey(storedKey);
      setNonce(storedNonce);
      setTag(storedTag);
      setState("encrypted");
      try {
        const bytes = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
        const blob  = new Blob([bytes], { type: "application/octet-stream" });
        setEncryptedFileUrl(URL.createObjectURL(blob));
        setEncryptedFile(new File([blob], "encrypted.bin", { type: "application/octet-stream" }));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (mode === "selective" && key && patches.length > 0 && selectiveImageUrl) {
      localStorage.setItem("siesh-mode",      mode);
      localStorage.setItem("siesh-key",       key);
      localStorage.setItem("siesh-patches",   JSON.stringify(patches));
      localStorage.setItem("siesh-sel-image", selectiveImageUrl);
    } else if (mode === "full" && encryptedBase64 && key && nonce && tag) {
      localStorage.setItem("siesh-mode",      mode);
      localStorage.setItem("siesh-encrypted", encryptedBase64);
      localStorage.setItem("siesh-key",       key);
      localStorage.setItem("siesh-nonce",     nonce);
      localStorage.setItem("siesh-tag",       tag);
    }
  }, [mode, encryptedBase64, key, nonce, tag, patches, selectiveImageUrl]);

  // ── Encrypted-data canvas visualisation (full mode) ───────────────────────

  useEffect(() => {
    if (!encryptedBase64) { setEncryptedImageUrl(""); return; }
    try {
      const bytes   = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
      const size    = Math.ceil(Math.sqrt(bytes.length / 3));
      const canvas  = document.createElement("canvas");
      canvas.width  = size;
      canvas.height = size;
      const ctx     = canvas.getContext("2d")!;
      const imgData = ctx.createImageData(size, size);
      for (let i = 0; i < size * size; i++) {
        imgData.data[i * 4]     = bytes[i * 3]     ?? 0;
        imgData.data[i * 4 + 1] = bytes[i * 3 + 1] ?? 0;
        imgData.data[i * 4 + 2] = bytes[i * 3 + 2] ?? 0;
        imgData.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      setEncryptedImageUrl(canvas.toDataURL());
    } catch { setEncryptedImageUrl(""); }
  }, [encryptedBase64]);

  // ── Canvas drawing ────────────────────────────────────────────────────────

  const drawRegionsOnCanvas = (regions: Region[]) => {
    const canvas = canvasRef.current;
    if (!canvas || !filePreviewUrl) return;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      regions.forEach(r => {
        ctx.strokeStyle = "rgba(0,255,180,0.9)";
        ctx.lineWidth   = 2;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle   = "rgba(0,255,180,0.15)";
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle   = "rgba(0,255,180,0.9)";
        ctx.font        = "12px monospace";
        ctx.fillText(r.label, r.x + 4, r.y + 14);
      });
    };
    img.src = filePreviewUrl;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect   = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasRef.current!.width  / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;
    setDrawStart({ x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY });
    setIsDrawing(true);
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const rect   = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasRef.current!.width  / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;
    const endX   = (e.clientX - rect.left) * scaleX;
    const endY   = (e.clientY - rect.top)  * scaleY;
    const newRegion: Region = {
      label: `region_${manualRegions.length + 1}`,
      x: Math.round(Math.min(drawStart.x, endX)),
      y: Math.round(Math.min(drawStart.y, endY)),
      w: Math.round(Math.abs(endX - drawStart.x)),
      h: Math.round(Math.abs(endY - drawStart.y)),
    };
    if (newRegion.w > 5 && newRegion.h > 5) {
      const updated = [...manualRegions, newRegion];
      setManualRegions(updated);
      drawRegionsOnCanvas(updated);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const reset = () => {
    setState("original");
    setFile(null); setFilePreviewUrl("");
    setEncryptedFile(null); setEncryptedFileUrl("");
    setDecryptFile(null);
    setNonce(""); setTag(""); setKey("");
    setEncryptedBase64(""); setEncryptedImageUrl("");
    setSelectiveImageUrl(""); setSelectiveFile(null);
    setPatches([]); setDetectedRegions([]);
    setManualRegions([]); setShowCanvas(false);
    setDecryptedUrl(""); setError(null);
    ["siesh-encrypted","siesh-nonce","siesh-tag","siesh-key",
     "siesh-patches","siesh-sel-image","siesh-mode"].forEach(k =>
      localStorage.removeItem(k));
  };

  const formatKeyDisplay = useMemo(() => {
    if (!key) return "";
    return key.replace(/(.{8})/g, "$1-").slice(0, -1);
  }, [key]);

  // ── API calls ─────────────────────────────────────────────────────────────

  const detectRegions = async () => {
    if (!file) return;
    setLoading(true); setLoadingMsg("Detecting sensitive regions…"); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${backendBase}/detect-regions/`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Detection failed (${res.status})`);
      const json = await res.json();
      setDetectedRegions(json.regions);
      setShowCanvas(true);
      setTimeout(() => drawRegionsOnCanvas(json.regions), 50);
      setState("detected");
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  const encryptFull = async () => {
    if (!file) return;
    setLoading(true); setLoadingMsg("Encrypting…"); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${backendBase}/encrypt/`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Encryption failed (${res.status})`);
      const json = await res.json();
      setKey(json.key); setNonce(json.nonce); setTag(json.tag);
      setEncryptedBase64(json.encrypted_data);
      const bytes = Uint8Array.from(atob(json.encrypted_data), c => c.charCodeAt(0));
      const blob  = new Blob([bytes], { type: "application/octet-stream" });
      setEncryptedFileUrl(URL.createObjectURL(blob));
      setEncryptedFile(new File([blob], `${file.name.replace(/\.[^/.]+$/, "")}_encrypted.bin`,
        { type: "application/octet-stream" }));
      setState("encrypted");
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  const encryptSelective = async () => {
    if (!file) return;
    setLoading(true); setLoadingMsg("Encrypting sensitive regions…"); setError(null);
    try {
      const regionsToSend = manualRegions.length > 0
        ? manualRegions
        : detectedRegions.length > 0
          ? detectedRegions
          : [];

      const form = new FormData();
      form.append("file", file);
      form.append("regions", JSON.stringify(regionsToSend));
      const res = await fetch(`${backendBase}/encrypt-selective/`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Encryption failed (${res.status})`);
      }
      const json = await res.json();
      setKey(json.key);
      setPatches(json.patches);

      // Store as data URL so it never goes stale (fixes blob ERR_FILE_NOT_FOUND)
      const dataUrl = `data:image/png;base64,${json.image}`;
      setSelectiveImageUrl(dataUrl);

      // Also keep a File object for the decrypt upload
      const imgBytes = Uint8Array.from(atob(json.image), c => c.charCodeAt(0));
      const imgBlob  = new Blob([imgBytes], { type: "image/png" });
      setSelectiveFile(new File([imgBlob],
        `${file.name.replace(/\.[^/.]+$/, "")}_selective.png`,
        { type: "image/png" }));

      setState("encrypted");
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  const encrypt = () => (isSelective ? encryptSelective() : encryptFull());

  const decrypt = async () => {
    setLoading(true); setLoadingMsg("Decrypting…"); setError(null);
    try {
      if (isSelective) {
        const fileToSend = decryptFile ?? selectiveFile;
        if (!fileToSend || patches.length === 0)
          throw new Error("No encrypted file or patch metadata");
        const form = new FormData();
        form.append("file", fileToSend);
        form.append("key", key);
        form.append("patches", JSON.stringify(patches));
        const res = await fetch(`${backendBase}/decrypt-selective/`, { method: "POST", body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail ?? `Decryption failed (${res.status})`);
        }
        const blob = await res.blob();
        setDecryptedUrl(URL.createObjectURL(blob));
      } else {
        const fileToSend = decryptFile ?? encryptedFile;
        if (!fileToSend) throw new Error("No encrypted file available");
        const form = new FormData();
        form.append("file", fileToSend);
        form.append("key", key);
        form.append("nonce", nonce);
        form.append("tag", tag);
        const res = await fetch(`${backendBase}/decrypt/`, { method: "POST", body: form });
        if (!res.ok) throw new Error(`Decryption failed (${res.status})`);
        const blob = await res.blob();
        setDecryptedUrl(URL.createObjectURL(blob));
      }
      setState("decrypted");
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setError(`${label} copied to clipboard`);
      setTimeout(() => setError(null), 2000);
    } catch (e) { setError(`Copy failed: ${(e as Error).message}`); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
          <div className="bg-glass rounded-2xl p-8 space-y-6">

            {/* Status bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${state === "encrypted" ? "bg-destructive" : "bg-primary"} animate-pulse-glow`} />
                <span className={`font-mono text-xs tracking-widest ${current.color}`}>{current.label}</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground/50">SIE v2.0</span>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg">
              {(["selective", "full"] as EncryptMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); reset(); }}
                  className={`flex-1 py-1.5 rounded-md font-mono text-xs tracking-wider uppercase transition-all ${
                    mode === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "selective" ? "Selective" : "Full Image"}
                </button>
              ))}
            </div>

            {/* Simulated ID card (no real image yet) */}
            {!filePreviewUrl && (
              <div className="bg-secondary/50 rounded-xl p-6 border border-border relative overflow-hidden">
                <div className="grid grid-cols-3 gap-4">
                  <div className="relative">
                    <div className={`w-full aspect-square rounded-lg transition-all duration-500 ${
                      current.encrypted ? "bg-destructive/20 border-destructive/50" : "bg-muted border-border"
                    } border-2 ${current.regions && !current.encrypted ? "border-primary border-dashed" : ""} flex items-center justify-center`}>
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
                  <div className="col-span-2 space-y-3">
                    {["70%", "50%"].map((w, i) => (
                      <div key={i} className={`h-4 rounded transition-all duration-500 ${
                        current.encrypted ? "bg-destructive/30" : current.regions
                          ? "bg-primary/20 border border-primary/40 border-dashed"
                          : "bg-muted-foreground/20"
                      }`} style={{ width: w }} />
                    ))}
                    {["60%", "40%", "55%"].map((w, i) => (
                      <div key={i} className="h-4 rounded bg-muted-foreground/10" style={{ width: w }} />
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border/50">
                  <div className="h-3 rounded bg-muted-foreground/10 w-1/3" />
                </div>
              </div>
            )}

            {/* Uploaded image preview */}
            {filePreviewUrl && state === "original" && (
              <div className="space-y-2">
                <div className="text-xs font-mono text-muted-foreground">Uploaded image</div>
                <img src={filePreviewUrl} alt="Original" className="w-full rounded-lg border border-border" />
              </div>
            )}

            {/* Region drawing canvas */}
            {showCanvas && filePreviewUrl && state !== "encrypted" && (
              <div className="space-y-2">
                <div className="text-xs font-mono text-muted-foreground">
                  Draw boxes over sensitive regions (drag to select)
                </div>
                <canvas
                  ref={canvasRef}
                  className="w-full rounded-lg border border-primary/40 cursor-crosshair"
                  onMouseDown={handleCanvasMouseDown}
                  onMouseUp={handleCanvasMouseUp}
                />
                <div className="flex gap-2 items-center">
                  <button
                    className="text-xs text-muted-foreground underline"
                    onClick={() => { setManualRegions([]); drawRegionsOnCanvas(detectedRegions); }}
                  >
                    Clear manual regions
                  </button>
                  <span className="text-xs text-muted-foreground/50">
                    {manualRegions.length} manual + {detectedRegions.length} auto-detected
                  </span>
                </div>
              </div>
            )}

            {/* Selective encrypted image */}
            {selectiveImageUrl && state === "encrypted" && isSelective && (
              <div className="space-y-2">
                <div className="text-xs font-mono text-muted-foreground">
                  Encrypted output — {patches.length} region{patches.length !== 1 ? "s" : ""} protected
                </div>
                <img src={selectiveImageUrl} alt="Selectively encrypted" className="w-full rounded-lg border border-destructive/30" />
                <div className="flex flex-wrap gap-2">
                  {patches.map((p, i) => (
                    <span key={i} className="text-xs font-mono px-2 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30">
                      {p.label}
                    </span>
                  ))}
                </div>
                <a className="text-xs text-primary underline block" href={selectiveImageUrl} download="encrypted_selective.png">Download encrypted image</a>
              </div>
            )}

            {/* Full-image encrypted visualisation */}
            {encryptedBase64 && state === "encrypted" && !isSelective && (
              <div className="space-y-2">
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
                    <img src={encryptedImageUrl} alt="Encrypted byte visualisation" className="max-w-full rounded-lg border border-border" />
                  </div>
                )}
                {encryptedFileUrl && (
                  <a className="text-xs text-primary underline block" href={encryptedFileUrl} download="encrypted.bin">Download encrypted file</a>
                )}
              </div>
            )}

            {/* Decrypted image */}
            {state === "decrypted" && decryptedUrl && (
              <div className="space-y-2">
                <div className="text-xs font-mono text-muted-foreground">Restored image</div>
                <img src={decryptedUrl} alt="Decrypted" className="w-full rounded-lg border border-primary/30" />
                <a className="text-xs text-primary underline block" href={decryptedUrl} download="decrypted.png">Download decrypted image</a>
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-muted-foreground/20 border border-border" />
                <span className="text-muted-foreground">Non-sensitive</span>
              </div>
              {current.regions && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded border-2 border-dashed border-primary bg-primary/10" />
                  <span className="text-primary">Detected region</span>
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

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-muted-foreground">Upload image to encrypt</label>
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
                      setManualRegions([]);
                      setDetectedRegions([]);
                      setShowCanvas(false);
                      setFilePreviewUrl(URL.createObjectURL(f));
                    }
                  }}
                />
              </div>

              {isSelective && hasFile && state === "original" && (
                <Button variant="cyber-outline" onClick={detectRegions} disabled={loading} className="w-full">
                  <ScanSearch className="w-4 h-4 mr-2" /> Detect Regions First (optional)
                </Button>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-muted-foreground">Or upload encrypted file to decrypt</label>
                <input
                  type="file"
                  accept="image/*,.bin,.png"
                  className="file-input"
                  disabled={loading}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setDecryptFile(f);
                    if (f) { setState("encrypted"); setError(null); }
                  }}
                />
              </div>

              {isSelective && state === "encrypted" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-mono text-muted-foreground">Patch metadata (auto-filled after encrypt)</label>
                  <textarea
                    rows={2}
                    className="w-full resize-none rounded border border-border bg-background/50 p-2 text-xs font-mono text-primary"
                    value={patches.length > 0 ? JSON.stringify(patches) : ""}
                    placeholder='[{"label":"face","x":0,"y":0,"w":100,"h":100,"nonce":"...","tag":"...","ciphertext":"..."}]'
                    onChange={(e) => {
                      try { setPatches(JSON.parse(e.target.value)); } catch { /* wait */ }
                    }}
                  />
                </div>
              )}

              {state === "encrypted" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-mono text-muted-foreground">Decryption key (base64)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded border border-border bg-background/50 p-2 text-xs font-mono text-primary"
                      value={key}
                      placeholder="Paste your base64 key here"
                      onChange={(e) => setKey(e.target.value)}
                    />
                    {key && (
                      <button type="button" className="text-xs text-primary underline shrink-0" onClick={() => copyToClipboard(key, "Key")}>
                        copy
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!isSelective && state === "encrypted" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-mono text-muted-foreground">Nonce</label>
                    <input type="text" className="rounded border border-border bg-background/50 p-2 text-xs font-mono text-primary" value={nonce} onChange={(e) => setNonce(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-mono text-muted-foreground">Tag</label>
                    <input type="text" className="rounded border border-border bg-background/50 p-2 text-xs font-mono text-primary" value={tag} onChange={(e) => setTag(e.target.value)} />
                  </div>
                </div>
              )}

              {(state === "encrypted" || state === "decrypted") && key && (
                <div className="bg-background/50 rounded-lg p-3 border border-border">
                  <div className="font-mono text-xs text-muted-foreground mb-1">UNIQUE IMAGE KEY (base64)</div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs text-primary break-all">{formatKeyDisplay}</div>
                    <button type="button" className="text-xs text-primary underline shrink-0" onClick={() => copyToClipboard(key, "Key")}>
                      copy
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="cyber" onClick={encrypt} className="flex-1" disabled={!canEncrypt || loading}>
                  <Lock className="w-4 h-4 mr-2" />
                  {isSelective ? "Encrypt Regions" : "Encrypt Image"}
                </Button>
                <Button variant="cyber" onClick={decrypt} className="flex-1" disabled={!canDecrypt || loading}>
                  <Unlock className="w-4 h-4 mr-2" /> Decrypt
                </Button>
              </div>

              {loading && (
                <div className="text-xs text-muted-foreground font-mono animate-pulse">{loadingMsg}</div>
              )}

              {error && (
                <div className={`text-xs font-mono ${error.includes("copied") ? "text-primary" : "text-destructive"}`}>
                  {error.includes("copied") ? error : `Error: ${error}`}
                </div>
              )}

              {state === "decrypted" && (
                <Button variant="cyber" onClick={reset} className="w-full">
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