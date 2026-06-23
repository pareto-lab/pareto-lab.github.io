import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Property } from "@/data/properties";
import { Calendar, Clock, BedDouble, Bath, Ruler } from "lucide-react";
import { trackCTAClick } from "@/utils/analytics";
import { propertyUrl } from "@/lib/propertyUrl";

interface PropertyCardProps {
  property: Property;
  index: number;
}

const PropertyCard = ({ property, index }: PropertyCardProps) => {
  const isDisabled = property.status === "off";

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const CardContent = () => (
    <>
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={property.image}
          alt={property.title}
          className={`w-full h-full object-cover transition-transform duration-700 ${
            isDisabled 
              ? "grayscale brightness-75 sepia-[0.2]" 
              : "group-hover:scale-105"
          }`}
        />
        {/* 준비 중 오버레이 */}
        {isDisabled && (
          <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
            <div className="bg-background/90 backdrop-blur-sm px-6 py-3 rounded-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">준비 중</span>
            </div>
          </div>
        )}
        {/* 오픈하우스 뱃지 (활성화된 매물만) */}
        {!isDisabled && property.openHouseEvents.length > 0 && (
          <div className="absolute top-4 left-4 bg-accent text-accent-foreground px-3 py-1.5 rounded-sm flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-xs font-medium uppercase tracking-wide">오픈하우스</span>
          </div>
        )}
      </div>
      <div className={`p-6 ${isDisabled ? "opacity-60" : ""}`}>
        <span className="editorial-subheading text-primary mb-2 block">
          {property.location}
        </span>
        <h3 className="font-serif text-2xl font-medium text-card-foreground mb-2 leading-tight">
          {property.title}
        </h3>
        <p className="text-muted-foreground mb-4 line-clamp-2">
          {property.subtitle}
        </p>
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <span className="font-serif text-xl text-card-foreground">
            {formatPrice(property.price)}
          </span>
          {property.specs && (
            <div className="flex items-center gap-3 text-muted-foreground text-sm">
              <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{property.specs.beds}</span>
              <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{property.specs.baths}</span>
              <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" />{
                (() => {
                  const area = property.specs!.landArea;
                  // Extract 평 value if present, otherwise convert from ㎡
                  const pyeongMatch = area.match(/(\d+)평/);
                  if (pyeongMatch) return `${pyeongMatch[1]}평`;
                  const m2Match = area.match(/([\d.]+)/);
                  if (m2Match) return `${Math.round(parseFloat(m2Match[1]) / 3.3)}평`;
                  return area;
                })()
              }</span>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      className={`card-editorial ${isDisabled ? "cursor-default" : "group"}`}
    >
      {isDisabled ? (
        <div className="block">
          <CardContent />
        </div>
      ) : (
        <Link 
          to={propertyUrl(property)}
          className="block"
          onClick={() => trackCTAClick("click_property_card", "main_property_listings", property.id)}
        >
          <CardContent />
        </Link>
      )}
    </motion.article>
  );
};

export default PropertyCard;
