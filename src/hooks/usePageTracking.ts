declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
    }
}

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function usePageTracking() {
    const location = useLocation();

    useEffect(() => {
        // GA4 page tracking
        window.gtag?.("config", "G-WLEHH28J26", {
            page_path: location.pathname + location.search,
        });

        // Dynamic canonical & og:url update for SEO
        const canonicalUrl = `https://paretolab.kr${location.pathname}`;

        const canonicalLink = document.querySelector('link[rel="canonical"]');
        if (canonicalLink) {
            canonicalLink.setAttribute("href", canonicalUrl);
        }

        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) {
            ogUrl.setAttribute("content", canonicalUrl);
        }
    }, [location]);
}
