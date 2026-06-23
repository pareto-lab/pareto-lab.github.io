export const trackCTAClick = (ctaName: string, sectionName: string, listingId?: string) => {
  if (typeof window.gtag !== "function") return;
  
  window.gtag("event", "cta_click", {
    page_type: "listing_detail",
    listing_id: listingId || "unknown",
    cta_name: ctaName,
    section_name: sectionName,
    page_location: window.location.href,
  });
};

export const trackSectionView = (sectionName: string, listingId?: string) => {
  if (typeof window.gtag !== "function") return;

  window.gtag("event", "section_view", {
    page_type: window.location.pathname === "/" ? "main" : "listing_detail",
    listing_id: listingId || "unknown",
    section_name: sectionName,
    page_location: window.location.href,
  });
};

export const trackLeadGeneration = (leadType: string, ctaName: string, listingId?: string) => {
  if (typeof window.gtag !== "function") return;

  window.gtag("event", "generate_lead", {
    page_type: "listing_detail",
    listing_id: listingId || "unknown",
    lead_type: leadType, // e.g. "reservation", "inquiry" 
    cta_name: ctaName,
    page_location: window.location.href,
  });
};

export const trackFormInteraction = (formName: string, stepName: string, listingId?: string) => {
  if (typeof window.gtag !== "function") return;

  const pageType = window.location.pathname === "/" ? "main" : "listing_detail";

  window.gtag("event", "form_interaction", {
    page_type: pageType,
    listing_id: listingId || "unknown",
    form_name: formName,
    step_name: stepName,
    page_location: window.location.href,
  });
};
