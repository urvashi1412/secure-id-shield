import { Shield, Lock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-id-card.png";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 grid-pattern opacity-40" />
      <div className="absolute inset-0 scanline" />
      
      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-accent/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />

      <div className="container relative z-10 mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-glass text-primary font-mono text-xs tracking-widest uppercase">
              <Shield className="w-3.5 h-3.5" />
              <span>Selective Image Encryption</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display leading-tight">
              <span className="text-foreground">Cryptographic</span>
              <br />
              <span className="text-gradient">Protection</span>
              <br />
              <span className="text-foreground">of Sensitive</span>
              <br />
              <span className="text-muted-foreground">Government IDs</span>
            </h1>

            <p className="text-muted-foreground text-lg max-w-lg leading-relaxed">
              ML-powered selective encryption that automatically detects and protects 
              sensitive regions of ID images while keeping non-sensitive areas intact.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button variant="cyber" size="lg">
                <Lock className="w-4 h-4 mr-2" />
                Try Demo
              </Button>
              <Button variant="cyber-outline" size="lg">
                <Eye className="w-4 h-4 mr-2" />
                Learn More
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-4">
              {[
                { value: "AES-256", label: "Encryption" },
                { value: "ML", label: "Detection" },
                { value: "Unique", label: "Per-Image Key" },
              ].map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <div className="text-primary font-mono text-lg font-bold glow-text">{stat.value}</div>
                  <div className="text-muted-foreground text-xs font-mono uppercase tracking-wider">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right image */}
          <div className="relative flex justify-center">
            <div className="relative animate-float">
              <div className="absolute -inset-4 bg-primary/10 rounded-2xl blur-2xl" />
              <img
                src={heroImage}
                alt="Encrypted government ID visualization"
                className="relative w-full max-w-md rounded-2xl border border-border"
              />
              {/* Overlay scan effect */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
