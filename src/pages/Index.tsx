import HeroSection from "@/components/HeroSection";
import ProcessFlow from "@/components/ProcessFlow";
import FeaturesSection from "@/components/FeaturesSection";
import EncryptionDemo from "@/components/EncryptionDemo";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <ProcessFlow />
      <EncryptionDemo />
      <FeaturesSection />
      <Footer />
    </div>
  );
};

export default Index;
