import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, RotateCcw } from "lucide-react";

type DemoState = "original" | "detected" | "encrypted" | "decrypted";

const EncryptionDemo = () => {
  const [state, setState] = useState<DemoState>("original");

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

  const advance = () => {
    const order: DemoState[] = ["original", "detected", "encrypted", "decrypted"];
    const idx = order.indexOf(state);
    if (idx < order.length - 1) setState(order[idx + 1]);
  };

  const reset = () => setState("original");

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
            <div className="flex gap-3">
              {state !== "decrypted" ? (
                <Button variant="cyber" onClick={advance} className="flex-1">
                  {state === "original" && "Detect Sensitive Regions"}
                  {state === "detected" && <><Lock className="w-4 h-4 mr-2" /> Encrypt Regions</>}
                  {state === "encrypted" && <><Unlock className="w-4 h-4 mr-2" /> Decrypt with Key</>}
                </Button>
              ) : (
                <Button variant="cyber" onClick={reset} className="flex-1">
                  <RotateCcw className="w-4 h-4 mr-2" /> Reset Demo
                </Button>
              )}
            </div>

            {/* Crypto key display */}
            {(state === "encrypted" || state === "decrypted") && (
              <div className="bg-background/50 rounded-lg p-3 border border-border">
                <div className="font-mono text-xs text-muted-foreground mb-1">UNIQUE IMAGE KEY</div>
                <div className="font-mono text-xs text-primary break-all">
                  aes256-gcm://7f3a9b2c4d8e1f0a...b5c6d7e8f9
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EncryptionDemo;
