import { Upload, ScanSearch, Lock, Send, KeyRound } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Upload",
    description: "Government ID image is uploaded to the system",
    detail: "INPUT",
  },
  {
    icon: ScanSearch,
    title: "ML Detection",
    description: "Machine learning identifies sensitive regions automatically",
    detail: "DETECT",
  },
  {
    icon: Lock,
    title: "Selective Encrypt",
    description: "Only sensitive areas are encrypted with a unique key",
    detail: "ENCRYPT",
  },
  {
    icon: Send,
    title: "Secure Transmit",
    description: "Partially encrypted image transmitted safely",
    detail: "TRANSMIT",
  },
  {
    icon: KeyRound,
    title: "Decrypt",
    description: "Authorized party uses unique key to restore original",
    detail: "RESTORE",
  },
];

const ProcessFlow = () => {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <span className="text-primary font-mono text-xs tracking-widest uppercase">System Architecture</span>
          <h2 className="text-3xl md:text-4xl font-bold font-display">
            How It <span className="text-gradient">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            The SIE pipeline processes government ID images through five stages, 
            ensuring optimal security with minimal computational overhead.
          </p>
        </div>

        <div className="relative">
          {/* Connection line */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent hidden lg:block" />

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {steps.map((step, i) => (
              <div key={step.title} className="relative group">
                <div className="bg-glass rounded-xl p-6 text-center space-y-4 transition-all duration-300 hover:glow-primary hover:border-primary/30">
                  {/* Step number */}
                  <div className="font-mono text-xs text-primary/60 tracking-widest">{step.detail}</div>
                  
                  {/* Icon */}
                  <div className="mx-auto w-14 h-14 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>

                  <h3 className="font-display font-semibold text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>

                  {/* Step indicator */}
                  <div className="font-mono text-xs text-muted-foreground/40">
                    {String(i + 1).padStart(2, '0')}/05
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProcessFlow;
