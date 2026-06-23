import { motion } from "framer-motion";
import heroImage from "@/assets/hero-house.jpg";
import { Button } from "@/components/ui/button";
import { trackCTAClick } from "@/utils/analytics";

const Hero = () => {
  const handleViewAllListings = () => {
    trackCTAClick("view_all_listings", "main_hero");
    document.getElementById("listings")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <section className="relative h-screen w-full overflow-hidden">
      <motion.div
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <img
          src={heroImage}
          alt="아름다운 해안가 주택의 석양"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/20 to-transparent" />
      </motion.div>

      <div className="relative h-full flex items-end pb-20 md:pb-32">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="max-w-2xl"
          >
            <span className="editorial-subheading text-primary-foreground/80 mb-4 block">
              추천 매물
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-primary-foreground font-medium leading-tight mb-6">
              삶이 빛나는 곳을 찾아서
            </h1>
            <p className="text-primary-foreground/80 text-lg md:text-xl mb-8 font-light leading-relaxed">
              라이프스타일을 담은 집. 당신의 새로운 이야기가 시작되는 곳.
            </p>
            <Button variant="heroOutline" size="lg" onClick={handleViewAllListings}>
              전체 매물 보기
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
