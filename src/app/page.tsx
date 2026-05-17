import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import WhySection from "@/components/WhySection";
import FeaturesSection from "@/components/FeaturesSection";
import ProcessSection from "@/components/ProcessSection";
import CtaSection from "@/components/CtaSection";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <WhySection />
      <FeaturesSection />
      <ProcessSection />
      <CtaSection />
    </>
  );
}
