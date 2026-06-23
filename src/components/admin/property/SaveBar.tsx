import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  error?: string | null;
}

const SaveBar = ({ dirty, saving, onSave, error }: Props) => {
  return (
    <div className="sticky bottom-0 -mx-1 px-1 pt-3 pb-2 bg-gradient-to-t from-background via-background to-transparent">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2 mb-2">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 bg-card border border-border rounded-sm px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {dirty ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              저장되지 않은 변경 사항이 있습니다
            </span>
          ) : (
            "변경 사항 없음"
          )}
        </span>
        <Button
          size="sm"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          이 탭 저장
        </Button>
      </div>
    </div>
  );
};

export default SaveBar;
