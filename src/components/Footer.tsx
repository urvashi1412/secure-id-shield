import { Shield } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-display font-semibold text-foreground">CryptoShield SIE</span>
          </div>
          <p className="text-muted-foreground text-sm font-mono">
            Selective Image Encryption for Government IDs
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
