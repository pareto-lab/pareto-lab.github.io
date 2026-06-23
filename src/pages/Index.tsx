import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { useLocation, useNavigate } from "react-router-dom";
import { trackSectionView } from "@/utils/analytics";

import Header from "@/components/Header";
import Hero from "@/components/Hero";
import PropertyListings from "@/components/PropertyListings";
import Footer from "@/components/Footer";
import PortfolioRequestButton from "@/components/PortfolioRequestButton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const Index = () => {
  useDocumentTitle("하우스인어스 | 단독주택 라이프스타일 포트폴리오");
  const [heroRef, heroInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [listingsRef, listingsInView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (heroInView) trackSectionView("main_hero", "main");
  }, [heroInView]);

  useEffect(() => {
    if (listingsInView) trackSectionView("main_property_listings", "main");
  }, [listingsInView]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get("scroll") !== "listings") {
      return;
    }

    const timer = window.setTimeout(() => {
      document.getElementById("listings")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      navigate("/", { replace: true });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [location.search, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <div ref={heroRef}><Hero /></div>
        <div ref={listingsRef}><PropertyListings /></div>
      </main>
      <Footer />
      <PortfolioRequestButton />
    </div>
  );
};

export default Index;
