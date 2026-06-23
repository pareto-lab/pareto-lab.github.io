import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { trackCTAClick } from "@/utils/analytics";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PropertyDetailBody from "@/components/PropertyDetailBody";
import { useProperty } from "@/hooks/useProperties";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token") ?? undefined;
  const birthdate = token && id
    ? (localStorage.getItem(`houseinus__delivery__${id}`) ?? undefined)
    : undefined;

  const { property, isLoading } = useProperty(id, { token, birthdate });
  useDocumentTitle(property ? `${property.title} | 하우스인어스` : undefined);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20">
          <Skeleton className="h-[70vh] w-full" />
          <div className="container mx-auto px-6 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-40 w-full" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-3xl text-foreground mb-4">매물을 찾을 수 없습니다</h1>
          <Link to="/" className="text-primary hover:underline">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (property?.id) trackCTAClick("view_print", "floating_button", property.id);
            navigate(`/properties/${id}/print`);
          }}
          className="shadow-lg gap-2"
        >
          <Printer className="w-4 h-4" />
          프린트 버전 보기
        </Button>
      </div>
      <PropertyDetailBody property={property} />
      <div className="flex justify-end px-6 py-4 bg-background">
        <button
          onClick={() => navigate(`/properties/${id}/upload`)}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-border text-muted-foreground opacity-30 hover:opacity-80 transition-opacity"
        >
          <ImageDown className="w-4 h-4" />
        </button>
      </div>
      <Footer />
    </div>
  );
};

export default PropertyDetail;
