import { useRef, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, GripVertical, Loader2, Search } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAdminBlogMenu,
  useAdminCreateMenuItem,
  useAdminUpdateMenuItem,
  useAdminDeleteMenuItem,
  useAdminReorderMenu,
  useAdminBlogTags,
} from "@/hooks/useAdminBlog";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type { BlogMenuItem, BlogMenuItemCreate } from "@/types/blog";

const ICON_OPTIONS = [
  "Home", "Star", "Tag", "BookOpen", "FileText", "Lightbulb", "TrendingUp",
  "ShoppingBag", "Users", "Globe", "Heart", "Briefcase", "Award", "Zap",
  "Coffee", "Camera", "Music", "Smile", "Bell", "Calendar",
  "Rss", "Newspaper", "PenLine", "Megaphone", "Package", "Layers",
  "BarChart2", "PieChart", "Map", "MapPin", "Building", "Building2",
  "Landmark", "DollarSign", "CreditCard", "Percent", "Receipt",
  "Wrench", "Settings", "Shield", "Lock", "Key", "Eye", "EyeOff",
  "ThumbsUp", "MessageCircle", "Share2", "Bookmark", "Hash",
  "Flame", "Leaf", "Sun", "Moon", "Cloud", "Umbrella",
];

function getIcon(name: string): React.ComponentType<{ className?: string }> | null {
  return ((LucideIcons as Record<string, unknown>)[name] as React.ComponentType<{ className?: string }> | undefined) ?? null;
}

function IconPreview({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  const Icon = getIcon(name);
  if (!Icon) return <span className="text-xs text-muted-foreground">?</span>;
  return <Icon className={className} />;
}

// ─── Icon picker popover ──────────────────────────────────────────────────────

interface IconPickerProps {
  value: string;
  onChange: (name: string) => void;
}

function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? ICON_OPTIONS.filter((n) => n.toLowerCase().includes(query.toLowerCase()))
    : ICON_OPTIONS;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors w-full"
      >
        <IconPreview name={value} className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">{value}</span>
        <LucideIcons.ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <>
          {/* Click-outside overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl w-72 p-2">
            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                autoFocus
                placeholder="아이콘 검색..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Icon grid */}
            <div className="grid grid-cols-7 gap-1 max-h-52 overflow-y-auto">
              {filtered.map((name) => {
                const Icon = getIcon(name);
                if (!Icon) return null;
                const isSelected = value === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => { onChange(name); setOpen(false); setQuery(""); }}
                    className={`flex items-center justify-center w-9 h-9 rounded-md transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-7 text-center text-xs text-muted-foreground py-4">
                  검색 결과 없음
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface EditForm {
  label: string;
  icon: string;
  tag_id: string;
  parent_id: string;
  sort_order: number;
}

function defaultForm(): EditForm {
  return { label: "", icon: "Tag", tag_id: "", parent_id: "", sort_order: 0 };
}

export default function AdminBlogMenu() {
  useDocumentTitle("블로그 메뉴 관리 | 관리자 | 하우스인어스");
  const { data: menuItems, isLoading } = useAdminBlogMenu();
  const { data: tags } = useAdminBlogTags();
  const createItem = useAdminCreateMenuItem();
  const updateItem = useAdminUpdateMenuItem();
  const deleteItem = useAdminDeleteMenuItem();
  const reorderItems = useAdminReorderMenu();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(defaultForm());

  // Flatten menu for reordering
  const flatTopLevel = menuItems ?? [];

  const handleCreate = async () => {
    if (!form.label.trim()) {
      toast({ title: "메뉴 이름을 입력해주세요.", variant: "destructive" });
      return;
    }
    const payload: BlogMenuItemCreate = {
      label: form.label.trim(),
      icon: form.icon || null,
      tag_id: form.tag_id || null,
      parent_id: form.parent_id || null,
      sort_order: flatTopLevel.length,
    };
    try {
      await createItem.mutateAsync(payload);
      setForm(defaultForm());
      setShowForm(false);
      toast({ title: "메뉴 항목이 추가되었습니다." });
    } catch (err: any) {
      toast({ title: err?.message ?? "추가 실패", variant: "destructive" });
    }
  };

  const startEdit = (item: BlogMenuItem) => {
    setEditingId(item.id);
    setForm({
      label: item.label,
      icon: item.icon ?? "Tag",
      tag_id: item.tag_id ?? "",
      parent_id: item.parent_id ?? "",
      sort_order: item.sort_order,
    });
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    try {
      await updateItem.mutateAsync({
        id: editingId,
        payload: {
          label: form.label.trim(),
          icon: form.icon || null,
          tag_id: form.tag_id || null,
          parent_id: form.parent_id || null,
          sort_order: form.sort_order,
        },
      });
      setEditingId(null);
      toast({ title: "수정되었습니다." });
    } catch (err: any) {
      toast({ title: err?.message ?? "수정 실패", variant: "destructive" });
    }
  };

  const handleDelete = async (item: BlogMenuItem) => {
    if (!confirm(`"${item.label}" 항목을 삭제할까요?`)) return;
    try {
      await deleteItem.mutateAsync(item.id);
      toast({ title: "삭제되었습니다." });
    } catch {
      toast({ title: "오류가 발생했습니다.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium">블로그 메뉴 설정</h1>
          <p className="text-sm text-muted-foreground mt-1">
            공개 블로그 좌측에 표시될 메뉴를 설정합니다. 첫 항목 "홈"은 항상 표시됩니다.
          </p>
        </div>
      </div>

      <div className="max-w-2xl space-y-1">
      {/* Static home item */}
      <div className="border border-border rounded-lg">
        <div className="flex items-center gap-3 p-3 opacity-60">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
          <LucideIcons.Home className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">홈</span>
          <span className="ml-auto text-xs text-muted-foreground">고정</span>
        </div>
      </div>

      {/* Dynamic items */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-1 mb-4">
          {flatTopLevel.map((item) => (
            <div key={item.id} className="border border-border rounded-lg overflow-hidden">
              {editingId === item.id ? (
                <div className="p-3">
                  <MenuForm
                    form={form}
                    setForm={setForm}
                    tags={tags}
                    flatTopLevel={flatTopLevel}
                    onSave={handleEditSave}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 p-3">
                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">
                      {item.icon ? <IconPreview name={item.icon} /> : <LucideIcons.Tag className="w-4 h-4" />}
                    </span>
                    <span className="text-sm font-medium flex-1">{item.label}</span>
                    {item.tag && (
                      <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                        {item.tag.name}
                      </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => startEdit(item)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {item.children && item.children.length > 0 && (
                    <div className="border-t border-border divide-y divide-border">
                      {item.children.map((child) => (
                        <div key={child.id} className="flex items-center gap-2 px-3 py-2 pl-10 bg-secondary/20">
                          <span className="text-xs text-muted-foreground flex-1">↳ {child.label}</span>
                          {child.tag && (
                            <span className="text-xs text-muted-foreground">{child.tag.name}</span>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => startEdit(child)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(child)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <MenuForm
          form={form}
          setForm={setForm}
          tags={tags}
          flatTopLevel={flatTopLevel}
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); setForm(defaultForm()); }}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-1" />
          메뉴 항목 추가
        </Button>
      )}
      </div>
    </div>
  );
}

interface MenuFormProps {
  form: EditForm;
  setForm: React.Dispatch<React.SetStateAction<EditForm>>;
  tags: import("@/types/blog").BlogTag[] | undefined;
  flatTopLevel: BlogMenuItem[];
  onSave: () => void;
  onCancel: () => void;
}

function MenuForm({ form, setForm, tags, flatTopLevel, onSave, onCancel }: MenuFormProps) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/30">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1">이름</Label>
          <Input
            placeholder="메뉴 이름"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs mb-1">아이콘</Label>
          <IconPicker
            value={form.icon || "Tag"}
            onChange={(name) => setForm((f) => ({ ...f, icon: name }))}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1">연결할 태그 (선택)</Label>
        <select
          value={form.tag_id}
          onChange={(e) => setForm((f) => ({ ...f, tag_id: e.target.value }))}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">— 연결 안 함 (섹션 헤더) —</option>
          {tags?.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-xs mb-1">상위 메뉴 (선택 — 2레벨 하위 항목으로 만들 경우)</Label>
        <select
          value={form.parent_id}
          onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">— 최상위 메뉴 —</option>
          {flatTopLevel.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSave}>
          <Check className="w-4 h-4 mr-1" />
          저장
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" />
          취소
        </Button>
      </div>
    </div>
  );
}
