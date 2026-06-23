import { useEffect, useRef } from "react";

declare global {
  interface Window {
    naver: {
      maps: {
        Map: new (el: HTMLElement, opts: object) => object;
        LatLng: new (lat: number, lng: number) => object;
        Marker: new (opts: object) => void;
      };
    };
    naverMapLoaded?: boolean;
  }
}

const CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined;

interface NaverMapViewProps {
  lat?: number;
  lng?: number;
  zoom?: number;
  className?: string;
}

const NaverMapView = ({
  lat = 37.2750955,
  lng = 127.151786,
  zoom = 16,
  className = "w-full h-full",
}: NaverMapViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;

    const initMap = () => {
      if (!containerRef.current || !window.naver?.maps) return;
      const location = new window.naver.maps.LatLng(lat, lng);
      const map = new window.naver.maps.Map(containerRef.current, {
        center: location,
        zoom,
      });
      new window.naver.maps.Marker({ position: location, map });
    };

    // If script is already loaded, init immediately
    if (window.naver?.maps) {
      initMap();
      return;
    }

    // Otherwise inject script tag
    const existing = document.getElementById("naver-map-script");
    if (!existing) {
      const script = document.createElement("script");
      script.id = "naver-map-script";
      script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${CLIENT_ID}`;
      script.async = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      existing.addEventListener("load", initMap);
    }

    return () => {};
  }, [lat, lng, zoom]);

  if (!CLIENT_ID) return null;

  return <div ref={containerRef} className={className} />;
};

export default NaverMapView;
