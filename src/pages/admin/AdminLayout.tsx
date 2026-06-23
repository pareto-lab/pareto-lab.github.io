import { useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Brain, CalendarDays, ExternalLink, Home, Inbox, Loader2, LogOut, Settings, ShieldCheck, Users, BookOpen, Tag, Menu as MenuIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import AdminAccessDenied from "./AdminAccessDenied";
import AgentSidePanel from "@/components/admin/agent/AgentSidePanel";

const AdminLayout = () => {
  const { loading, isAdmin, user, logout } = useAuth();
  const navigate = useNavigate();

  // Pushing the redirect into an effect so we can render <Navigate> without
  // tripping React's "can't update during render" rule for unauthenticated users.
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login?redirect=/admin", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    // Effect above will navigate; render nothing in the meantime.
    return null;
  }

  if (!isAdmin) return <AdminAccessDenied />;

  const onLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar (fixed to viewport so main-content scroll doesn't stretch it) */}
      <aside className="hidden md:flex md:flex-col fixed top-0 left-0 h-screen w-60 border-r border-border bg-card z-30">
        <Link
          to="/admin"
          className="flex items-center gap-2 px-5 py-5 border-b border-border shrink-0"
        >
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-serif text-lg font-medium">관리자</span>
        </Link>
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          <NavLink
            to="/admin/properties"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
          >
            <Home className="w-4 h-4" />
            매물 관리
          </NavLink>
          <NavLink
            to="/admin/open-house-calendar"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
          >
            <CalendarDays className="w-4 h-4" />
            오픈하우스 캘린더
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
          >
            <Users className="w-4 h-4" />
            유저 관리
          </NavLink>
          <NavLink
            to="/admin/inquiries"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
          >
            <Inbox className="w-4 h-4" />
            문의·의뢰
          </NavLink>
          <NavLink
            to="/admin/mbti-results"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
          >
            <Brain className="w-4 h-4" />
            MBTI 결과
          </NavLink>

          {/* Blog section */}
          <div className="pt-3 pb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            블로그
          </div>
          <NavLink
            to="/admin/blog/posts"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
          >
            <BookOpen className="w-4 h-4" />
            블로그 글
          </NavLink>
          <NavLink
            to="/admin/blog/tags"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
          >
            <Tag className="w-4 h-4" />
            블로그 태그
          </NavLink>
          <NavLink
            to="/admin/blog/menu"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
          >
            <MenuIcon className="w-4 h-4" />
            블로그 메뉴
          </NavLink>
        </nav>
        <div className="p-3 border-t border-border space-y-2 shrink-0">
          <div className="text-xs text-muted-foreground px-2">
            <div className="font-medium text-foreground truncate">
              {user?.display_name}
            </div>
            <div className="truncate">{user?.email}</div>
            <div className="mt-1 inline-block bg-secondary rounded px-1.5 py-0.5">
              {user?.role}
            </div>
          </div>
          <NavLink
            to="/admin/me"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
          >
            <Settings className="w-4 h-4" />
            내 관리자 정보
          </NavLink>
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-sm text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            홈으로
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            로그아웃
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to="/admin" className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-serif text-base font-medium">관리자</span>
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" aria-label="홈으로">
              <ExternalLink className="w-4 h-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/me">
              <Settings className="w-4 h-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex">
        <NavLink
          to="/admin/properties"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 text-xs ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`
          }
        >
          <Home className="w-5 h-5 mb-0.5" />
          매물
        </NavLink>
        <NavLink
          to="/admin/open-house-calendar"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 text-xs ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`
          }
        >
          <CalendarDays className="w-5 h-5 mb-0.5" />
          캘린더
        </NavLink>
        <NavLink
          to="/admin/users"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 text-xs ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`
          }
        >
          <Users className="w-5 h-5 mb-0.5" />
          유저
        </NavLink>
        <NavLink
          to="/admin/inquiries"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 text-xs ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`
          }
        >
          <Inbox className="w-5 h-5 mb-0.5" />
          문의
        </NavLink>
        <NavLink
          to="/admin/mbti-results"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 text-xs ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`
          }
        >
          <Brain className="w-5 h-5 mb-0.5" />
          MBTI
        </NavLink>
      </nav>

      <main className="flex-1 md:ml-60 md:p-8 px-4 pt-16 pb-20 md:pt-8 md:pb-8 min-w-0">
        <Outlet />
      </main>
      <AgentSidePanel />
    </div>
  );
};

export default AdminLayout;
