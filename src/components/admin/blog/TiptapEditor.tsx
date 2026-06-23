import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/extension-bubble-menu";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ResizableImage from "tiptap-extension-resize-image";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Link as LinkIcon,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Code2,
  Minus, AlignLeft, AlignCenter, AlignRight, Image as ImageIcon, Table as TableIcon,
} from "lucide-react";
import { useAdminUploadBlogImage } from "@/hooks/useAdminBlog";
import { useToast } from "@/hooks/use-toast";

const lowlight = createLowlight(common);

// ─── Slash command items ──────────────────────────────────────────────────────

interface SlashItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  execute: (editor: Editor) => void;
}

const SLASH_ITEMS: SlashItem[] = [
  { title: "제목 1", description: "큰 제목", icon: <Heading1 className="w-4 h-4" />, execute: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: "제목 2", description: "중간 제목", icon: <Heading2 className="w-4 h-4" />, execute: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: "제목 3", description: "작은 제목", icon: <Heading3 className="w-4 h-4" />, execute: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { title: "글머리 목록", description: "순서 없는 목록", icon: <List className="w-4 h-4" />, execute: (e) => e.chain().focus().toggleBulletList().run() },
  { title: "번호 목록", description: "순서 있는 목록", icon: <ListOrdered className="w-4 h-4" />, execute: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: "할 일 목록", description: "체크박스 목록", icon: <CheckSquare className="w-4 h-4" />, execute: (e) => e.chain().focus().toggleTaskList().run() },
  { title: "인용구", description: "텍스트 인용", icon: <Quote className="w-4 h-4" />, execute: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: "코드 블록", description: "코드 영역", icon: <Code2 className="w-4 h-4" />, execute: (e) => e.chain().focus().toggleCodeBlock().run() },
  { title: "구분선", description: "가로 구분선", icon: <Minus className="w-4 h-4" />, execute: (e) => e.chain().focus().setHorizontalRule().run() },
  { title: "표", description: "3×3 표 삽입", icon: <TableIcon className="w-4 h-4" />, execute: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
];

interface SlashMenuState {
  show: boolean;
  x: number;
  y: number;
  query: string;
  selectedIndex: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TiptapEditorProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  draftKey?: string;
  placeholder?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export function TiptapEditor({
  content,
  onChange,
  draftKey,
  placeholder = "내용을 입력하세요. '/'를 입력하면 블록을 추가할 수 있습니다.",
  onDirtyChange,
}: TiptapEditorProps) {
  const uploadImage = useAdminUploadBlogImage();
  const { toast } = useToast();
  const isDirtyRef = useRef(false);
  const initialContentApplied = useRef(false);

  const [slashMenu, setSlashMenu] = useState<SlashMenuState>({
    show: false, x: 0, y: 0, query: "", selectedIndex: 0,
  });
  const slashMenuRef = useRef(slashMenu);
  slashMenuRef.current = slashMenu;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder }),
      ResizableImage.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      BubbleMenu.configure({
        shouldShow: ({ editor: e, from, to }) => from !== to && !e.isActive("image"),
      }),
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none outline-none min-h-full p-6",
      },
    },
    content: Object.keys(content).length > 0 ? content : undefined,
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON() as Record<string, unknown>;
      onChange(json);
      isDirtyRef.current = true;
      onDirtyChange?.(true);
      if (draftKey) {
        try { localStorage.setItem(draftKey, JSON.stringify(json)); } catch {}
      }
    },
  });

  // Apply content when it loads asynchronously (editing existing post)
  useEffect(() => {
    if (!editor || initialContentApplied.current || Object.keys(content).length === 0) return;
    editor.commands.setContent(content, false);
    initialContentApplied.current = true;
  }, [editor, content]);

  // Restore draft from localStorage if no content has been applied yet
  useEffect(() => {
    if (!editor || !draftKey || Object.keys(content).length > 0) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        editor.commands.setContent(parsed, false);
        initialContentApplied.current = true;
        toast({ title: "임시저장된 내용을 불러왔습니다." });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, draftKey]);

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Slash command detection
  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => {
      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;
      const lineText = $from.parent.textContent;
      const cursorOffset = $from.parentOffset;
      const textUpToCursor = lineText.slice(0, cursorOffset);
      const slashIdx = textUpToCursor.lastIndexOf("/");

      if (slashIdx !== -1 && (slashIdx === 0 || /\s/.test(textUpToCursor[slashIdx - 1] ?? ""))) {
        const query = textUpToCursor.slice(slashIdx + 1);
        if (!query.includes(" ")) {
          const coords = editor.view.coordsAtPos(selection.from);
          setSlashMenu({
            show: true,
            x: coords.left,
            y: coords.bottom + window.scrollY + 4,
            query,
            selectedIndex: 0,
          });
          return;
        }
      }
      setSlashMenu((s) => (s.show ? { ...s, show: false } : s));
    };
    editor.on("update", handleUpdate);
    editor.on("selectionUpdate", () => setSlashMenu((s) => (s.show ? { ...s, show: false } : s)));
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!slashMenuRef.current.show) return;
      const filtered = SLASH_ITEMS.filter((item) =>
        item.title.includes(slashMenuRef.current.query)
      );
      if (!filtered.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenu((s) => ({ ...s, selectedIndex: (s.selectedIndex + 1) % filtered.length }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenu((s) => ({ ...s, selectedIndex: (s.selectedIndex - 1 + filtered.length) % filtered.length }));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[slashMenuRef.current.selectedIndex];
        if (item && editor) {
          executeSlashCommand(item, editor, slashMenuRef.current.query);
        }
      } else if (e.key === "Escape") {
        setSlashMenu((s) => ({ ...s, show: false }));
      }
    },
    [editor]
  );

  const executeSlashCommand = (item: SlashItem, ed: Editor, query: string) => {
    const { state } = ed;
    const { from } = state.selection;
    const lineStart = state.selection.$from.start();
    const lineText = state.doc.textBetween(lineStart, from);
    const slashIdx = lineText.lastIndexOf("/");
    if (slashIdx !== -1) {
      ed.chain().focus().deleteRange({ from: lineStart + slashIdx, to: from }).run();
    }
    item.execute(ed);
    setSlashMenu((s) => ({ ...s, show: false, query: "" }));
  };

  const handleImageUpload = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      try {
        const { url } = await uploadImage.mutateAsync(file);
        editor.chain().focus().setImage({ src: url }).run();
      } catch {
        toast({ title: "이미지 업로드 실패", variant: "destructive" });
      }
    };
    input.click();
  }, [editor, uploadImage, toast]);

  const handleSetLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL을 입력하세요", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const filteredSlash = SLASH_ITEMS.filter((item) =>
    item.title.includes(slashMenu.query)
  );

  return (
    <div className="relative">
      {/* Fixed toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border border-border rounded-t-md bg-card sticky top-0 z-10">
        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="굵게"><Bold className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="기울임"><Italic className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="밑줄"><UnderlineIcon className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="취소선"><Strikethrough className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="인라인 코드"><Code className="w-4 h-4" /></Btn>
        <Sep />
        <Btn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="제목 1"><Heading1 className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="제목 2"><Heading2 className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="제목 3"><Heading3 className="w-4 h-4" /></Btn>
        <Sep />
        <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="글머리 목록"><List className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="번호 목록"><ListOrdered className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="할 일 목록"><CheckSquare className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="인용구"><Quote className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="코드 블록"><Code2 className="w-4 h-4" /></Btn>
        <Sep />
        <Btn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="구분선"><Minus className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("table")} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="표"><TableIcon className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("link")} onClick={handleSetLink} title="링크"><LinkIcon className="w-4 h-4" /></Btn>
        <Btn active={false} onClick={handleImageUpload} title="이미지"><ImageIcon className="w-4 h-4" /></Btn>
        <Sep />
        <Btn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="왼쪽 정렬"><AlignLeft className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="가운데 정렬"><AlignCenter className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="오른쪽 정렬"><AlignRight className="w-4 h-4" /></Btn>
      </div>

      {/* Bubble menu (floating on selection) */}
      {editor && (
        <div
          id="bubble-menu-container"
          className="hidden"
        />
      )}

      {/* Editor area */}
      <EditorContent
        editor={editor}
        onKeyDown={handleKeyDown}
        className="border border-t-0 border-border rounded-b-md h-[70vh] overflow-y-auto [&_.tiptap_p]:my-1 [&_.tiptap_ul]:my-1 [&_.tiptap_ol]:my-1 [&_.tiptap_li]:my-0 [&_.tiptap_h1]:mt-3 [&_.tiptap_h1]:mb-1 [&_.tiptap_h2]:mt-3 [&_.tiptap_h2]:mb-1 [&_.tiptap_h3]:mt-2 [&_.tiptap_h3]:mb-1 [&_.tiptap_blockquote]:my-2 [&_.tiptap_pre]:my-2 [&_.tiptap_p.is-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-empty:first-child::before]:float-left [&_.tiptap_p.is-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-empty:first-child::before]:pointer-events-none [&_.tiptap_ul[data-type=taskList]]:list-none [&_.tiptap_ul[data-type=taskList]_li]:flex [&_.tiptap_ul[data-type=taskList]_li]:gap-2 [&_.tiptap_ul[data-type=taskList]_li>label]:mt-0.5"
      />

      {/* Slash command dropdown */}
      {slashMenu.show && filteredSlash.length > 0 && (
        <div
          className="fixed z-50 bg-card border border-border rounded-lg shadow-xl w-60 overflow-hidden"
          style={{ left: slashMenu.x, top: slashMenu.y }}
        >
          <div className="py-1">
            {filteredSlash.map((item, i) => (
              <button
                key={item.title}
                type="button"
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
                  i === slashMenu.selectedIndex
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-secondary text-foreground"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (editor) executeSlashCommand(item, editor, slashMenu.query);
                }}
              >
                <span className="text-muted-foreground">{item.icon}</span>
                <div>
                  <div className="font-medium leading-tight">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Read-only viewer ─────────────────────────────────────────────────────────

export function TiptapViewer({ content }: { content: Record<string, unknown> }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      ResizableImage.configure({ inline: false }),
      Link.configure({ openOnClick: true, HTMLAttributes: { class: "text-primary underline" } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none outline-none",
      },
    },
    content: Object.keys(content).length > 0 ? content : undefined,
    editable: false,
  });

  return (
    <EditorContent
      editor={editor}
      className="[&_.tiptap_ul[data-type=taskList]]:list-none [&_.tiptap_ul[data-type=taskList]_li]:flex [&_.tiptap_ul[data-type=taskList]_li]:gap-2 [&_.tiptap_ul[data-type=taskList]_li>label]:mt-0.5"
    />
  );
}

// ─── Toolbar helpers ──────────────────────────────────────────────────────────

function Btn({ children, active, onClick, title }: {
  children: React.ReactNode; active: boolean; onClick: () => void; title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-border mx-0.5" />;
}
