import { Link, useLocation } from "react-router-dom";
import { Home, ChevronDown, ChevronRight, Menu, X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useState } from "react";
import { useBlogMenu } from "@/hooks/useBlog";
import type { BlogMenuItem } from "@/types/blog";

function getIcon(name: string | null): React.ReactNode {
  if (!name) return null;
  const Icon = (LucideIcons as Record<string, unknown>)[name] as React.ComponentType<{ className?: string }> | undefined;
  if (!Icon) return null;
  return <Icon className="w-4 h-4" />;
}

function menuHref(item: BlogMenuItem): string {
  if (item.tag?.slug) return `/blog/tag/${item.tag.slug}`;
  return "/blog";
}

interface MenuItemRowProps {
  item: BlogMenuItem;
  level?: number;
  onClick?: () => void;
}

function MenuItemRow({ item, level = 0, onClick }: MenuItemRowProps) {
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  const href = menuHref(item);
  const isActive =
    (href === "/blog" && location.pathname === "/blog") ||
    (href !== "/blog" && location.pathname.startsWith(href));

  return (
    <div>
      <div className="flex items-center">
        <Link
          to={href}
          onClick={onClick}
          className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-md text-sm transition-colors ${
            level === 0 ? "font-medium" : "pl-7 text-muted-foreground"
          } ${
            isActive
              ? "bg-primary/10 text-primary"
              : "hover:bg-secondary text-foreground"
          }`}
        >
          {level === 0 && item.icon && (
            <span className="text-muted-foreground">{getIcon(item.icon)}</span>
          )}
          <span>{item.label}</span>
        </Link>
        {hasChildren && level === 0 && (
          <button
            type="button"
            className="p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-label="하위 메뉴 토글"
          >
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {hasChildren && open && level === 0 && (
        <div className="mt-0.5">
          {item.children.map((child) => (
            <MenuItemRow key={child.id} item={child} level={1} onClick={onClick} />
          ))}
        </div>
      )}
    </div>
  );
}

interface BlogSidebarProps {
  className?: string;
}

export function BlogSidebar({ className = "" }: BlogSidebarProps) {
  const location = useLocation();
  const { data: menuItems } = useBlogMenu();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isHomeActive = location.pathname === "/blog";

  const sidebarContent = (
    <nav className="space-y-0.5">
      {/* Home — always first */}
      <Link
        to="/blog"
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isHomeActive
            ? "bg-primary/10 text-primary"
            : "hover:bg-secondary text-foreground"
        }`}
      >
        <Home className="w-4 h-4 text-muted-foreground" />
        홈
      </Link>

      {menuItems?.map((item) => (
        <MenuItemRow
          key={item.id}
          item={item}
          onClick={() => setMobileOpen(false)}
        />
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden md:block w-56 shrink-0 ${className}`}>
        <div className="sticky top-24">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-3">
            카테고리
          </div>
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile: floating toggle button + drawer */}
      <div className="md:hidden">
        <button
          type="button"
          className="fixed bottom-6 left-4 z-40 bg-card border border-border rounded-full p-3 shadow-lg"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="카테고리 메뉴"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed bottom-20 left-4 z-40 bg-card border border-border rounded-xl shadow-xl p-4 w-56">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                카테고리
              </div>
              {sidebarContent}
            </aside>
          </>
        )}
      </div>
    </>
  );
}
