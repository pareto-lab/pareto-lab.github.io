import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  extractSheetId,
  getStoredSheetId,
  setStoredSheetId,
  clearStoredSheetId,
} from "@/lib/googleSheets";
import { useToast } from "@/hooks/use-toast";
import { Settings, Link2, Unlink, FileSpreadsheet, ExternalLink } from "lucide-react";

const SheetConnector = () => {
  const [open, setOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const currentSheetId = getStoredSheetId();

  const handleConnect = async () => {
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      toast({
        title: "잘못된 URL",
        description: "올바른 Google Sheets URL을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      // 연결 테스트
      const response = await fetch(
        `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`
      );
      if (!response.ok) {
        throw new Error("시트에 접근할 수 없습니다.");
      }

      setStoredSheetId(sheetId);
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast({
        title: "연결 완료",
        description: "Google Sheets가 성공적으로 연결되었습니다.",
      });
      setOpen(false);
      setSheetUrl("");
    } catch (error) {
      toast({
        title: "연결 실패",
        description: "시트가 '웹에 게시' 되어있는지 확인해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearStoredSheetId();
    queryClient.invalidateQueries({ queryKey: ["properties"] });
    toast({
      title: "연결 해제",
      description: "기본 데이터로 전환되었습니다.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Google Sheets 연결
          </DialogTitle>
          <DialogDescription>
            매물 데이터를 Google Sheets에서 실시간으로 가져옵니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 현재 상태 */}
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    currentSheetId ? "bg-green-500" : "bg-muted-foreground"
                  }`}
                />
                <span className="text-sm text-foreground">
                  {currentSheetId ? "시트 연결됨" : "연결된 시트 없음"}
                </span>
              </div>
              {currentSheetId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  className="gap-2"
                >
                  <Unlink className="h-3 w-3" />
                  연결 해제
                </Button>
              )}
            </div>
          </div>

          {/* 연결 폼 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Google Sheets URL
              </label>
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <Button
              onClick={handleConnect}
              disabled={!sheetUrl || isConnecting}
              className="w-full gap-2"
            >
              <Link2 className="h-4 w-4" />
              {isConnecting ? "연결 중..." : "시트 연결하기"}
            </Button>
          </div>

          {/* 안내 */}
          <div className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
            <h4 className="font-medium text-foreground">시트 설정 방법</h4>
            <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
              <li>Google Sheets에서 새 스프레드시트 생성</li>
              <li>
                첫 행에 헤더 입력:{" "}
                <code className="rounded bg-muted px-1 text-xs">
                  id, title, subtitle, location, price, image, lifestylestory,
                  lifestylehighlights, openhouseevents, monthlypayment,
                  maxloanamount, interestrate, loanterm
                </code>
              </li>
              <li>파일 → 공유 → 웹에 게시 → 게시 클릭</li>
              <li>스프레드시트 URL 복사 후 위에 붙여넣기</li>
            </ol>
            <a
              href="https://docs.google.com/spreadsheets/create"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              새 Google Sheets 만들기
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SheetConnector;
