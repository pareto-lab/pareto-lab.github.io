/**
 * "준비 중" placeholder cards shown after the real DB-backed listings.
 * Mirrors the three coming-soon properties from the static houseinus-web
 * (pareto-lab.github.io) era. Remove this component once enough real
 * properties are published to fill the listings grid on their own.
 */
import PropertyCard from "./PropertyCard";
import type { Property } from "@/data/properties";
import property1 from "@/assets/property-1.jpg";
import property2 from "@/assets/property-2.jpg";

const EMPTY_LOAN_INFO = {
  estimatedMonthlyPayment: 0,
  maxLoanAmount: 0,
  interestRate: 0,
  loanTerm: 0,
};

const PLACEHOLDER_PROPERTIES: Property[] = [
  {
    id: "placeholder-1",
    slug: null,
    title: "햇살이 머무는 고요한 안식처",
    subtitle: "여유로운 아침과 창의적인 오후를 위한 공간",
    location: "경기도 용인시 수지구",
    price: 850_000_000,
    image: property1,
    lifestyleStory: "",
    lifestyleHighlights: [],
    status: "off",
    specs: { beds: 4, baths: 2, landArea: "76평" },
    openHouseEvents: [],
    tags: ["새벽배송", "수영장"],
    loanInfo: EMPTY_LOAN_INFO,
  },
  {
    id: "placeholder-2",
    slug: null,
    title: "모임의 예술",
    subtitle: "주방에서의 대화가 소중한 추억이 되는 곳",
    location: "경기도 용인시 기흥구",
    price: 720_000_000,
    image: property2,
    lifestyleStory: "",
    lifestyleHighlights: [],
    status: "off",
    specs: { beds: 4, baths: 2, landArea: "96평" },
    openHouseEvents: [],
    tags: ["강남으로 출근", "잔디마당", "초등학교"],
    loanInfo: EMPTY_LOAN_INFO,
  },
];

interface PropertyPlaceholdersProps {
  /** Continue the staggered fade-in animation from the last real card. */
  startIndex?: number;
}

const PropertyPlaceholders = ({ startIndex = 0 }: PropertyPlaceholdersProps) => (
  <>
    {PLACEHOLDER_PROPERTIES.map((property, i) => (
      <PropertyCard
        key={property.id}
        property={property}
        index={startIndex + i}
      />
    ))}
  </>
);

export default PropertyPlaceholders;
