import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface ExpandableTextProps {
  children: React.ReactNode;
  maxLines?: number;
  className?: string;
}

const ExpandableText = ({ children, maxLines = 10, className = "" }: ExpandableTextProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={className}>
      <div
        className={expanded ? "" : ""}
        style={!expanded ? {
          display: "-webkit-box",
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden",
        } : undefined}
      >
        {children}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 mt-3 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? '접기' : '더 보기'}
      </button>
    </div>
  );
};

export default ExpandableText;
