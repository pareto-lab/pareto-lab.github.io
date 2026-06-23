import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SheetConnector from "@/components/SheetConnector";
import { ShieldAlert } from "lucide-react";

const Admin = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 py-32 container mx-auto px-6 max-w-3xl">
        <div className="bg-secondary/30 border border-border rounded-lg p-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-medium mb-4">관리자 전용 페이지</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
            부동산 매물 동기화 및 구글 시트 데이터베이스 연동을 관리할 수 있습니다. 
            <br />
            우측 하단의 <strong>설정 버튼(⚙️)</strong>을 눌러 연동 메뉴를 열어주세요.
          </p>
        </div>
      </main>

      <SheetConnector />
      <Footer />
    </div>
  );
};

export default Admin;
