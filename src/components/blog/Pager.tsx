import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PagerProps {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}

function getPageWindow(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
  const result: (number | "...")[] = [];
  const addPage = (p: number) => result.push(p);
  const addEllipsis = () => {
    if (result[result.length - 1] !== "...") result.push("...");
  };

  addPage(0);
  if (page - 2 > 1) addEllipsis();
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages - 2, page + 2); i++) addPage(i);
  if (page + 2 < totalPages - 2) addEllipsis();
  addPage(totalPages - 1);
  return result;
}

export function Pager({ page, totalPages, onChange }: PagerProps) {
  if (totalPages <= 1) return null;
  const window = getPageWindow(page, totalPages);

  return (
    <Pagination className="mt-10">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => onChange(page - 1)}
            aria-disabled={page === 0}
            className={page === 0 ? "pointer-events-none opacity-40" : "cursor-pointer"}
          />
        </PaginationItem>

        {window.map((item, idx) =>
          item === "..." ? (
            <PaginationItem key={`ellipsis-${idx}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                isActive={item === page}
                onClick={() => onChange(item)}
                className="cursor-pointer"
              >
                {item + 1}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationNext
            onClick={() => onChange(page + 1)}
            aria-disabled={page === totalPages - 1}
            className={page === totalPages - 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
