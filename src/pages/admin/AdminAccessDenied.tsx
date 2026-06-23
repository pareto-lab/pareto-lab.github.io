import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const AdminAccessDenied = () => {
  useDocumentTitle("권한 없음 | 하우스인어스");
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-6 pt-24 pb-16">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 mx-auto bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="font-serif text-2xl font-medium mb-2">
            관리자 권한이 필요한 페이지입니다
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            현재 계정으로는 이 페이지에 접근할 수 없습니다.
          </p>
          <Button asChild className="w-full">
            <Link to="/">홈으로 돌아가기</Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default AdminAccessDenied;
