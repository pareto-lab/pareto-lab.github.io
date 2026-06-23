import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Plus, Search } from "lucide-react";
import { useAdminPropertyList, useCreateProperty } from "@/hooks/useAdminProperties";
import type { PropertyStatus } from "@/types/property";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDateKst } from "@/lib/datetime";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const STATUS_FILTERS: { value: PropertyStatus; label: string }[] = [
  { value: "draft", label: "초안" },
  { value: "published", label: "공개" },
  { value: "archived", label: "보관" },
];

const formatPrice = (won: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(won);

const formatUnderTenThousand = (value: number) => {
  if (value < 100) return value.toLocaleString("ko-KR");

  const thousands = Math.floor(value / 1000);
  const hundreds = Math.floor((value % 1000) / 100);
  const rest = value % 100;

  let text = "";
  if (thousands > 0) text += `${thousands}천`;
  if (hundreds > 0) text += `${hundreds}백`;
  if (rest > 0) text += rest.toLocaleString("ko-KR");

  return text || "0";
};

const formatPriceInKoreanUnits = (won: number) => {
  if (!Number.isFinite(won) || won < 0) return "";
  if (won === 0) return "0 원";

  let rest = Math.floor(won);
  const parts: string[] = [];

  const jo = Math.floor(rest / 1_000_000_000_000);
  if (jo > 0) {
    parts.push(`${jo.toLocaleString("ko-KR")}조`);
    rest %= 1_000_000_000_000;
  }

  const eok = Math.floor(rest / 100_000_000);
  if (eok > 0) {
    parts.push(`${eok.toLocaleString("ko-KR")}억`);
    rest %= 100_000_000;
  }

  const man = Math.floor(rest / 10_000);
  if (man > 0) {
    parts.push(`${formatUnderTenThousand(man)}만`);
    rest %= 10_000;
  }

  if (rest > 0) {
    parts.push(rest.toLocaleString("ko-KR"));
  }

  return `${parts.join("")} 원`;
};

// Date format helpers moved to src/lib/datetime.ts.

const statusVariant = (
  s: PropertyStatus,
): "default" | "secondary" | "outline" =>
  s === "published" ? "default" : s === "draft" ? "secondary" : "outline";

const AdminProperties = () => {
  useDocumentTitle("매물 관리 | 관리자 | 하우스인어스");
  const navigate = useNavigate();
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<PropertyStatus[]>(["draft", "published"]);
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newPrice, setNewPrice] = useState<string>("");
  const parsedNewPrice = Number(newPrice.replace(/,/g, ""));
  const newPricePreview =
    Number.isFinite(parsedNewPrice) && parsedNewPrice > 0
      ? formatPriceInKoreanUnits(parsedNewPrice)
      : "";

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(rawSearch.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [rawSearch]);

  const { data, isLoading, isFetching, error } = useAdminPropertyList({
    q: search,
    statuses,
    page,
  });

  const createMut = useCreateProperty();

  const toggleStatus = (s: PropertyStatus) => {
    setPage(0);
    setStatuses((curr) =>
      curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s],
    );
  };

  const handleCreate = async () => {
    const price = Number(newPrice.replace(/,/g, ""));
    if (!newTitle.trim() || !newLocation.trim() || !price || price < 0) return;
    const created = await createMut.mutateAsync({
      title: newTitle.trim(),
      location: newLocation.trim(),
      price,
    });
    setCreateOpen(false);
    setNewTitle("");
    setNewLocation("");
    setNewPrice("");
    navigate(`/admin/properties/${created.id}`);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium">매물 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            매물 목록을 확인하고 새 매물을 추가합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-sm text-muted-foreground">
              전체 {data.total.toLocaleString()}건
            </span>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />새 매물
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 매물</DialogTitle>
                <DialogDescription>
                  최소 정보만 입력해 초안을 만든 뒤 상세 편집으로 이동합니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="new-title">제목</Label>
                  <Input
                    id="new-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="예: 햇살이 머무는 고요한 안식처"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-location">위치</Label>
                  <Input
                    id="new-location"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="예: 경기도 용인시"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-price">가격 (원)</Label>
                  <Input
                    id="new-price"
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="650000000"
                  />
                  {newPricePreview && (
                    <p className="text-xs text-muted-foreground">
                      {newPricePreview}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={createMut.isPending}
                >
                  취소
                </Button>
                <Button onClick={handleCreate} disabled={createMut.isPending}>
                  {createMut.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  생성
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="제목 또는 위치 검색"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statuses.includes(f.value) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleStatus(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
          {error instanceof Error ? error.message : "목록을 불러오지 못했습니다"}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative">
        {(isLoading || isFetching) && (
          <div className="absolute -top-8 right-0">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {data?.items.length === 0 && !isLoading && (
          <div className="col-span-full text-center text-muted-foreground py-12 border border-dashed border-border rounded-sm">
            매물이 없습니다
          </div>
        )}
        {data?.items.map((p) => (
          <Link
            key={p.id}
            to={`/admin/properties/${p.id}`}
            className="block bg-card border border-border rounded-sm overflow-hidden hover:border-primary/40 transition-colors"
          >
            <div className="aspect-[4/3] bg-secondary relative">
              {p.hero_image ? (
                <img
                  src={p.hero_image.url}
                  alt={p.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  대표 이미지 없음
                </div>
              )}
              <Badge
                variant={statusVariant(p.status)}
                className="absolute top-2 left-2"
              >
                {STATUS_FILTERS.find((s) => s.value === p.status)?.label ?? p.status}
              </Badge>
            </div>
            <div className="p-3 space-y-1">
              <h3 className="font-serif text-base font-medium line-clamp-1">
                {p.title}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {p.location}
              </p>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-sm font-medium">
                  {formatPrice(p.price)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  수정 {formatDateKst(p.updated_at)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminProperties;
