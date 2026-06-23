import { useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Code2,
  ExternalLink,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAdminProperty,
  useArchiveProperty,
  usePublishProperty,
} from "@/hooks/useAdminProperties";
import type { Property, PropertyStatus } from "@/types/property";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import BasicTab from "./property/BasicTab";
import PhotosTab from "./property/PhotosTab";
import FloorplansTab from "./property/FloorplansTab";
import InteriorTab from "./property/InteriorTab";
import NearbyMetricsTab from "./property/NearbyMetricsTab";
import ScenariosTab from "./property/ScenariosTab";
import EventsLoanTab from "./property/EventsLoanTab";
import DeliveryTab from "./property/DeliveryTab";
import { propertyUrl } from "@/lib/propertyUrl";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const statusLabel = (s: PropertyStatus) =>
  s === "draft" ? "초안" : s === "published" ? "공개" : "보관";
const statusVariant = (s: PropertyStatus) =>
  s === "published" ? "default" : s === "draft" ? "secondary" : "outline";

const AdminPropertyEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: property, isLoading, error } = useAdminProperty(id);
  useDocumentTitle(
    property
      ? `${property.title} 편집 | 관리자 | 하우스인어스`
      : "매물 편집 | 관리자 | 하우스인어스",
  );
  const publishMut = usePublishProperty(id ?? "");
  const archiveMut = useArchiveProperty(id ?? "");
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "basic";
  const setTab = (value: string) => setSearchParams({ tab: value }, { replace: true });
  const [actionError, setActionError] = useState<string | null>(null);
  if (!id) return <Navigate to="/admin/properties" replace />;

  if (isLoading || !property) {
    if (error) {
      return (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/properties">
              <ArrowLeft className="w-4 h-4 mr-1" /> 목록으로
            </Link>
          </Button>
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
            {error instanceof Error ? error.message : "매물을 불러오지 못했습니다"}
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const togglePublish = async () => {
    setActionError(null);
    try {
      await publishMut.mutateAsync(
        property.status === "published" ? "unpublish" : "publish",
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const archive = async () => {
    try {
      await archiveMut.mutateAsync();
      navigate("/admin/properties");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const siteViewHref =
    property.status === "published"
      ? propertyUrl(property)
      : `/admin/properties/${property.id}/preview`;

  return (
    <div className="space-y-6 max-w-5xl">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/properties">
          <ArrowLeft className="w-4 h-4 mr-1" /> 목록으로
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium break-all">
            {property.title || "(제목 없음)"}
          </h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Badge variant={statusVariant(property.status)}>
              {statusLabel(property.status)}
            </Badge>
            <span>{property.location}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/admin/properties/${property.id}/preview`}>
              <Eye className="w-4 h-4 mr-2" /> 미리보기
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/admin/properties/${property.id}/json`}>
              <Code2 className="w-4 h-4 mr-2" /> JSON 수정
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={siteViewHref} target="_blank">
              <ExternalLink className="w-4 h-4 mr-2" /> 사이트에서 보기
            </Link>
          </Button>
          <Button
            variant={property.status === "published" ? "outline" : "default"}
            onClick={togglePublish}
            disabled={publishMut.isPending}
          >
            {publishMut.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {property.status === "published" ? "공개 취소" : "공개"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>이 매물을 보관할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  공개 상태가 즉시 해제되고 어드민 목록에서도 사라집니다.
                  복구가 필요하면 DB에서 직접 처리해야 합니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void archive();
                  }}
                  className="bg-destructive text-destructive-foreground"
                >
                  보관
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {actionError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
          {actionError}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full h-auto">
          <TabsTrigger value="basic">기본</TabsTrigger>
          <TabsTrigger value="photos">사진</TabsTrigger>
          <TabsTrigger value="floorplans">평면도</TabsTrigger>
          <TabsTrigger value="interior">인테리어</TabsTrigger>
          <TabsTrigger value="nearby">주변·평가</TabsTrigger>
          <TabsTrigger value="scenarios">시나리오</TabsTrigger>
          <TabsTrigger value="events">일정·대출</TabsTrigger>
          <TabsTrigger value="delivery">납품</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="pt-6">
          <BasicTab property={property} />
        </TabsContent>
        <TabsContent value="photos" className="pt-6">
          <PhotosTab property={property} />
        </TabsContent>
        <TabsContent value="floorplans" className="pt-6">
          <FloorplansTab property={property} />
        </TabsContent>
        <TabsContent value="interior" className="pt-6">
          <InteriorTab property={property} />
        </TabsContent>
        <TabsContent value="nearby" className="pt-6">
          <NearbyMetricsTab property={property} />
        </TabsContent>
        <TabsContent value="scenarios" className="pt-6">
          <ScenariosTab property={property} />
        </TabsContent>
        <TabsContent value="events" className="pt-6">
          <EventsLoanTab property={property} />
        </TabsContent>
        <TabsContent value="delivery" className="pt-6">
          <DeliveryTab property={property} />
        </TabsContent>
      </Tabs>

    </div>
  );
};

export type AdminPropertyTabProps = { property: Property };

export default AdminPropertyEdit;
