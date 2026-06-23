import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Loader2, Printer } from "lucide-react";
import { useAdminProperty } from "@/hooks/useAdminProperties";
import { useAdminOpenHouseEvents } from "@/hooks/useAdminOpenHouse";
import { adaptProperty } from "@/lib/propertyAdapter";
import PropertyDetailBody from "@/components/PropertyDetailBody";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const AdminPropertyPreview = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useAdminProperty(id);
  const eventsQuery = useAdminOpenHouseEvents(id ?? "");
  useDocumentTitle(
    data
      ? `${data.title} 미리보기 | 관리자 | 하우스인어스`
      : "매물 미리보기 | 관리자 | 하우스인어스",
  );

  if (!id) return <Navigate to="/admin/properties" replace />;

  return (
    <div className="-m-4 md:-m-8">
      <div className="sticky top-16 md:top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 md:px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/admin/properties/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            편집으로 돌아가기
          </Link>
        </Button>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          미리보기 — 사용자 화면 그대로 보입니다 (저장된 데이터 기준)
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/properties/${id}/print?from=preview`}>
              <Printer className="h-4 w-4 mr-1" />
              프린트 버전 보기
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error || !data ? (
        <div className="p-12 text-center">
          <h2 className="font-serif text-2xl mb-2">매물을 불러오지 못했습니다</h2>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "알 수 없는 오류"}
          </p>
        </div>
      ) : (
        <div className="bg-background">
          <PropertyDetailBody
            property={{
              ...adaptProperty(data),
              // open_house_events는 별도 API로 관리되므로
              // eventsQuery에서 가져온 최신 이벤트를 덮어씁니다.
              openHouseEvents: (eventsQuery.data?.items ?? []).map((e) => ({
                id: e.id,
                date: e.date,
                time: e.time,
                availableSpots: e.available_spots,
                capacity: e.capacity ?? null,
                reservationCount: e.reservation_count,
                status: e.status ?? null,
              })),
            }}
            trackViews={false}
            backLink={null}
          />
        </div>
      )}
    </div>
  );
};

export default AdminPropertyPreview;
