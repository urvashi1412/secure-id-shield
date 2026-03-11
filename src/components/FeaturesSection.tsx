import { Cpu, Fingerprint, ShieldCheck, Zap, Database, Network } from "lucide-react";

const features = [
  {
    icon: Cpu,
    title: "ML-Powered Detection",
    description: "Automatic identification of sensitive regions—no manual selection required.",
  },
  {
    icon: Fingerprint,
    title: "Unique Cryptographic Keys",
    description: "Each image is assigned a unique key, ensuring individualized protection.",
  },
  {
    icon: ShieldCheck,
    title: "Data Integrity",
    description: "Robust encryption ensures confidentiality and tamper-proof data integrity.",
  },
  {
    icon: Zap,
    title: "Computational Efficiency",
    description: "Encrypting only sensitive regions drastically reduces processing overhead.",
  },
  {
    icon: Database,
    title: "Selective Encryption",
    description: "Non-sensitive areas remain intact and usable during transmission.",
  },
  {
    icon: Network,
    title: "Secure Transmission",
    description: "Optimized for digital platforms requiring secure ID image sharing.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="relative py-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <span className="text-primary font-mono text-xs tracking-widest uppercase">Core Capabilities</span>
          <h2 className="text-3xl md:text-4xl font-bold font-display">
            Key <span className="text-gradient">Features</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-glass rounded-xl p-8 space-y-4 group hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
