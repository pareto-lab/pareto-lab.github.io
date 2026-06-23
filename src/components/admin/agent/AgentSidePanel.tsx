import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronRight,
  Circle,
  Loader2,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  Square,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api, getToken } from "@/lib/apiClient";
import { hasDirtyForms } from "@/hooks/useDirtyGuard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { messageForError } from "@/lib/errorMessage";

interface AgentSession {
  id: string;
  agent_provider: string;
  conversation_id: string | null;
  model: string | null;
  cwd: string;
  running: boolean;
  pending_approvals: AgentApproval[];
}

interface AgentApproval {
  type: "approval_request";
  approval_id: string;
  method: string;
  params: Record<string, unknown>;
}

interface AgentEvent {
  type: string;
  text?: string;
  method?: string;
  session?: AgentSession;
  approval_id?: string;
  decision?: string;
  params?: Record<string, unknown>;
  raw?: unknown;
}

interface ChatEntry {
  id: string;
  role: "user" | "assistant" | "system" | "stderr" | "error";
  text: string;
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 420;

const MCP_TOOL_COMPLETED_PATTERN =
  /^MCP tool completed:\s*houseinus-admin\.(\S+)$/;
const MUTATION_TOOL_PREFIXES = [
  "update_",
  "create_",
  "delete_",
  "publish_",
  "unpublish_",
  "archive_",
  "ban_",
  "unban_",
  "restore_",
  "reorder_",
  "set_",
];

function describeError(error: unknown): string {
  if (error instanceof ApiError && error.detail) {
    return `${messageForError(error)}\n${error.detail}`;
  }
  if (error instanceof Error && error.message) return error.message;
  return messageForError(error);
}

function approvalTitle(approval: AgentApproval): string {
  if (approval.method === "execCommandApproval") return "명령 실행 승인";
  if (approval.method === "applyPatchApproval") return "파일 변경 승인";
  if (approval.method === "mcpServer/elicitation/request") return "MCP 도구 실행 승인";
  return "승인 요청";
}

function approvalBody(approval: AgentApproval): string {
  const params = approval.params || {};
  if (approval.method === "mcpServer/elicitation/request") {
    const message = params.message as string | undefined;
    const requestedSchema = params.requestedSchema as Record<string, unknown> | undefined;
    const tool = (requestedSchema as Record<string, unknown> | undefined)?.title as string | undefined;
    return message || (tool ? `도구: ${tool}` : JSON.stringify(params, null, 2));
  }
  const command = params.command;
  if (Array.isArray(command)) return command.join(" ");
  const fileChanges = params.fileChanges;
  if (fileChanges && typeof fileChanges === "object") {
    return Object.keys(fileChanges).join(", ");
  }
  return JSON.stringify(params, null, 2);
}

function eventToEntry(event: AgentEvent): ChatEntry | null {
  const id = `${Date.now()}-${Math.random()}`;
  if (event.type === "user" && event.text) {
    return { id, role: "user", text: event.text };
  }
  if (event.type === "assistant" && event.text) {
    return { id, role: "assistant", text: event.text };
  }
  if (event.type === "error" && event.text) {
    return { id, role: "error", text: event.text };
  }
  if (event.type === "rpc_error") {
    return { id, role: "error", text: JSON.stringify(event.raw, null, 2) };
  }
  if (event.type === "stderr" && event.text) {
    return { id, role: "stderr", text: event.text };
  }
  if (event.type === "system" && event.text) {
    if (event.text === "Turn started.") return null;
    if (event.text.startsWith("Thread status changed:")) return null;
    return { id, role: "system", text: event.text };
  }
  if (event.type === "ready") {
    return { id, role: "system", text: "Agent session ready." };
  }
  if (event.type === "task_complete") {
    return null;
  }
  if (event.type === "closed") {
    return { id, role: "system", text: "Agent process closed." };
  }
  return null;
}

const AgentSidePanel = () => {
  const [open, setOpen] = useState(() => localStorage.getItem("agent-panel-open") !== "false");
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem("agent-panel-width"));
    return Number.isFinite(saved) && saved >= MIN_WIDTH ? saved : DEFAULT_WIDTH;
  });
  const [session, setSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [approvals, setApprovals] = useState<AgentApproval[]>([]);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [turnActive, setTurnActive] = useState(false);
  const [activityText, setActivityText] = useState("");
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  const [activityElapsedSeconds, setActivityElapsedSeconds] = useState(0);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  // Codex emits one agentMessage item per pre/post tool-call segment. We seal
  // the assistant box on each item/completed so the next item's deltas open a
  // fresh box instead of getting appended.
  const lastAssistantSealedRef = useRef(false);
  const queryClient = useQueryClient();

  const runInvalidate = useCallback(
    (tool: string) => {
      if (tool.includes("property")) {
        queryClient.invalidateQueries({ queryKey: ["admin-property"] });
        queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
        queryClient.invalidateQueries({ queryKey: ["public-property"] });
        return;
      }
      if (tool.includes("blog")) {
        queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
        queryClient.invalidateQueries({ queryKey: ["blog"] });
        return;
      }
      if (tool.includes("user")) {
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        return;
      }
      if (tool.includes("open_house")) {
        queryClient.invalidateQueries({ queryKey: ["admin-open-house-calendar"] });
        queryClient.invalidateQueries({ queryKey: ["admin-open-house-inquiries"] });
        return;
      }
      if (tool.includes("inquir") || tool.includes("mbti")) {
        queryClient.invalidateQueries({
          predicate: (q) =>
            typeof q.queryKey[0] === "string" &&
            q.queryKey[0].startsWith("admin-"),
        });
      }
    },
    [queryClient],
  );

  const invalidateForTool = useCallback(
    (tool: string) => {
      if (hasDirtyForms()) {
        toast("Agent가 서버 데이터를 변경했어요", {
          description:
            "저장하지 않은 편집이 있어서 화면을 자동으로 새로고침하지 않았어요. 편집을 저장하거나 버린 뒤 새로고침을 누르세요.",
          action: {
            label: "새로고침",
            onClick: () => runInvalidate(tool),
          },
          duration: 15000,
        });
        return;
      }
      runInvalidate(tool);
    },
    [runInvalidate],
  );

  useEffect(() => {
    localStorage.setItem("agent-panel-open", String(open));
  }, [open]);

  useEffect(() => {
    localStorage.setItem("agent-panel-width", String(width));
  }, [width]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, approvals]);

  useEffect(() => {
    if (!turnActive || !turnStartedAt) {
      setActivityElapsedSeconds(0);
      return;
    }
    const updateElapsed = () => {
      setActivityElapsedSeconds(Math.floor((Date.now() - turnStartedAt) / 1000));
    };
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [turnActive, turnStartedAt]);

  const pushEvent = useCallback((event: AgentEvent) => {
    if (event.type === "session" && event.session) {
      setSession(event.session);
      setApprovals(event.session.pending_approvals ?? []);
      return;
    }
    if (event.type === "ready" && event.session) {
      setSession(event.session);
    }
    if (event.type === "approval_request") {
      setApprovals((prev) => {
        if (prev.some((item) => item.approval_id === event.approval_id)) return prev;
        return [...prev, event as AgentApproval];
      });
    }
    if (event.type === "approval_resolved" && event.approval_id) {
      setApprovals((prev) => prev.filter((item) => item.approval_id !== event.approval_id));
    }
    if (event.method === "turn/started") {
      setTurnActive(true);
      setTurnStartedAt(Date.now());
      setActivityText("생각하는 중");
    }
    if (event.method === "turn/completed" || event.type === "task_complete" || event.type === "error") {
      setTurnActive(false);
      setTurnStartedAt(null);
      setActivityText("");
    }
    if (event.method === "item/started" && event.text) {
      setActivityText(event.text);
    }
    if (event.method === "item/mcpToolCall/progress" && event.text) {
      setActivityText(event.text);
    }
    if (event.type === "system" && event.text?.startsWith("MCP tool started:")) {
      setActivityText(event.text);
    }
    if (event.type === "system" && event.text) {
      const match = MCP_TOOL_COMPLETED_PATTERN.exec(event.text);
      if (match) {
        const tool = match[1];
        if (MUTATION_TOOL_PREFIXES.some((p) => tool.startsWith(p))) {
          invalidateForTool(tool);
        }
      }
    }
    if (event.type === "assistant_delta" && event.text) {
      setTurnActive(true);
      setTurnStartedAt((prev) => prev ?? Date.now());
      setActivityText("응답 작성 중");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const sealed = lastAssistantSealedRef.current;
        if (last?.role === "assistant" && !sealed) {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              text: `${last.text}${event.text}`,
            },
          ];
        }
        lastAssistantSealedRef.current = false;
        return [
          ...prev.slice(-300),
          { id: `${Date.now()}-${Math.random()}`, role: "assistant", text: event.text ?? "" },
        ];
      });
      return;
    }
    if (event.type === "assistant" && event.text) {
      setActivityText("마무리 중");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          // Exact duplicate emit (legacy + new event for same item) — skip.
          if (last.text === event.text) {
            lastAssistantSealedRef.current = true;
            return prev;
          }
          // Box still open from in-flight deltas → adopt canonical text.
          if (!lastAssistantSealedRef.current && event.text?.startsWith(last.text)) {
            lastAssistantSealedRef.current = true;
            return [...prev.slice(0, -1), { ...last, text: event.text }];
          }
        }
        lastAssistantSealedRef.current = true;
        return [
          ...prev.slice(-300),
          { id: `${Date.now()}-${Math.random()}`, role: "assistant", text: event.text ?? "" },
        ];
      });
      return;
    }
    const entry = eventToEntry(event);
    if (entry) setMessages((prev) => [...prev.slice(-300), entry]);
  }, [invalidateForTool]);

  const connectEvents = useCallback(() => {
    wsRef.current?.close();
    const token = getToken();
    if (!token) return;
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${scheme}://${window.location.host}/api/v1/admin/agent/sessions/current/events?token=${encodeURIComponent(token)}`,
    );
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (message) => {
      try {
        pushEvent(JSON.parse(message.data) as AgentEvent);
      } catch {
        /* ignore malformed bridge event */
      }
    };
  }, [pushEvent]);

  const startSession = useCallback(async () => {
    setStarting(true);
    setMessages([]);
    setApprovals([]);
    setTurnActive(false);
    setTurnStartedAt(null);
    setActivityText("");
    try {
      const data = await api<AgentSession>("/api/v1/admin/agent/sessions", {
        method: "POST",
      });
      setSession(data);
      setApprovals(data.pending_approvals ?? []);
      connectEvents();
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}`, role: "error", text: describeError(error) },
      ]);
      throw error;
    } finally {
      setStarting(false);
    }
  }, [connectEvents]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { id: `${Date.now()}`, role: "user", text }]);
    try {
      if (!session?.running) await startSession();
      await api("/api/v1/admin/agent/sessions/current/messages", {
        method: "POST",
        body: { text, pathname: window.location.pathname } as unknown as BodyInit,
      });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}`, role: "error", text: describeError(error) },
      ]);
    }
  }, [input, session?.running, startSession]);

  const stopSession = useCallback(async () => {
    wsRef.current?.close();
    setSession(null);
    setApprovals([]);
    setTurnActive(false);
    setTurnStartedAt(null);
    setActivityText("");
    setMessages((prev) => [...prev, { id: `${Date.now()}`, role: "system", text: "Stopping." }]);
    try {
      await api("/api/v1/admin/agent/sessions/current/stop", { method: "POST" });
      setMessages((prev) => [...prev, { id: `${Date.now()}`, role: "system", text: "Stopped." }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}`, role: "error", text: describeError(error) },
      ]);
    }
  }, []);

  const interrupt = useCallback(async () => {
    try {
      await api("/api/v1/admin/agent/sessions/current/interrupt", { method: "POST" });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}`, role: "error", text: describeError(error) },
      ]);
    }
  }, []);

  const restartSession = useCallback(async () => {
    wsRef.current?.close();
    setApprovals([]);
    setTurnActive(false);
    setTurnStartedAt(null);
    setActivityText("");
    try {
      await api("/api/v1/admin/agent/sessions/current/stop", { method: "POST" });
    } catch {
      // best-effort stop; we're starting a fresh session next regardless
    }
    setSession(null);
    setMessages([]);
    await startSession();
  }, [startSession]);

  const resolveApproval = useCallback(async (approvalId: string, decision: string) => {
    try {
      await api(`/api/v1/admin/agent/sessions/current/approvals/${approvalId}`, {
        method: "POST",
        body: { decision } as unknown as BodyInit,
      });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}`, role: "error", text: describeError(error) },
      ]);
    }
  }, []);

  const statusLabel = useMemo(() => {
    if (starting) return "starting";
    if (connected) return "connected";
    if (session?.running) return "running";
    return "idle";
  }, [connected, session?.running, starting]);

  const beginResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const onMove = (moveEvent: MouseEvent) => {
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth - (moveEvent.clientX - startX)));
      setWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="fixed right-4 top-20 z-40 h-10 w-10 bg-card shadow-sm"
        onClick={() => setOpen(true)}
      >
        <Bot className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <>
    <div aria-hidden="true" className="hidden md:block shrink-0" style={{ width }} />
    <aside
      className="fixed bottom-0 right-0 top-0 z-30 hidden border-l border-border bg-card md:flex"
      style={{ width }}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30"
        onMouseDown={beginResize}
      />
      <div className="flex h-screen w-full flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <div className="min-w-0">
              <div className="text-sm font-medium">Agent</div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Circle className={cn("h-2 w-2 fill-current", connected ? "text-emerald-600" : "text-muted-foreground")} />
                {statusLabel}
                {session?.model ? ` · ${session.model}` : ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {session?.running ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="새 대화 시작"
                onClick={() => {
                  if (window.confirm("지금 대화 종료하고 새 대화 시작할까요?")) {
                    void restartSession();
                  }
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={startSession}
                disabled={starting}
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {!session ? (
            <div className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground">
              <Button size="sm" className="mb-3 h-8" onClick={startSession} disabled={starting}>
                {starting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-2 h-3.5 w-3.5" />}
                Start
              </Button>
              <div>관리자 작업용 agent session을 시작합니다.</div>
            </div>
          ) : null}

          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded border px-3 py-2 text-sm leading-relaxed",
                  message.role === "user" && "ml-8 border-primary/20 bg-primary/5",
                  message.role === "assistant" && "mr-8 border-border bg-background",
                  message.role === "system" && "border-border bg-secondary/40 text-muted-foreground text-xs",
                  message.role === "stderr" && "border-destructive/30 bg-destructive/5 text-xs text-destructive",
                  message.role === "error" && "border-destructive/40 bg-destructive/10 text-sm text-destructive",
                )}
              >
                {message.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none min-w-0
                      prose-p:my-1 prose-headings:my-2
                      prose-table:text-xs prose-table:border-collapse
                      [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap
                      prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1
                      prose-th:border prose-th:border-border prose-th:px-2 prose-th:py-1 prose-th:bg-muted
                      prose-code:bg-muted prose-code:text-foreground prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:break-all prose-code:before:content-none prose-code:after:content-none
                      prose-pre:bg-muted prose-pre:text-foreground prose-pre:p-2 prose-pre:rounded prose-pre:text-xs prose-pre:overflow-x-auto
                      prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-sans">{message.text}</pre>
                )}
              </div>
            ))}
          </div>

          {approvals.length ? (
            <div className="mt-4 space-y-3">
              {approvals.map((approval) => (
                <div key={approval.approval_id} className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                  <div className="mb-2 flex items-center gap-2 font-medium text-amber-950">
                    <ShieldAlert className="h-4 w-4" />
                    {approvalTitle(approval)}
                  </div>
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs text-amber-950">
                    {approvalBody(approval)}
                  </pre>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="h-8" onClick={() => resolveApproval(approval.approval_id, "approved")}>
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => resolveApproval(approval.approval_id, "denied")}>
                      <X className="mr-1 h-3.5 w-3.5" />
                      Deny
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {turnActive ? (
            <div className="mt-3 mr-8 rounded border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>
                  {activityText || "작업 중"}
                  {activityElapsedSeconds >= 10 ? ` · ${activityElapsedSeconds}s` : ""}
                </span>
              </div>
              {activityElapsedSeconds >= 30 ? (
                <div className="mt-1 pl-5 text-xs">
                  오래 걸리고 있습니다. 중단하려면 입력창 옆 Stop 버튼을 누르세요.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="border-t border-border p-3">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onCompositionStart={() => {
                composingRef.current = true;
              }}
              onCompositionEnd={() => {
                composingRef.current = false;
              }}
              onKeyDown={(event) => {
                const nativeEvent = event.nativeEvent as KeyboardEvent;
                if (composingRef.current || nativeEvent.isComposing || nativeEvent.keyCode === 229) {
                  return;
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (turnActive) return;
                  void sendMessage();
                }
              }}
              placeholder="Agent에게 요청"
              className="min-h-[64px] resize-none text-sm"
            />
            <Button
              className="h-16 w-11 shrink-0"
              size="icon"
              variant={turnActive ? "secondary" : "default"}
              title={turnActive ? "Turn 종료" : "전송"}
              onClick={() => {
                if (turnActive) {
                  void interrupt();
                } else {
                  void sendMessage();
                }
              }}
            >
              {turnActive ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </footer>
      </div>
    </aside>
    </>
  );
};

export default AgentSidePanel;
