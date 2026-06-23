import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { UserCircle2, LogOut, Settings, ShieldCheck } from "lucide-react";
import { trackCTAClick } from "@/utils/analytics";
import { useAuth, type AuthUser } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const UserMenu = ({
  user,
  isAdmin,
  onLogout,
}: {
  user: AuthUser;
  isAdmin: boolean;
  onLogout: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label="내 계정 메뉴"
        className="editorial-subheading hover:text-primary transition-colors flex items-center"
      >
        <UserCircle2 className="w-4 h-4" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56">
      <DropdownMenuLabel className="font-normal">
        <div className="text-sm font-medium truncate">{user.display_name}</div>
        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link to="/me" className="cursor-pointer">
          <Settings className="w-4 h-4 mr-2" />
          계정 관리
        </Link>
      </DropdownMenuItem>
      {isAdmin && (
        <DropdownMenuItem asChild>
          <Link to="/admin" className="cursor-pointer">
            <ShieldCheck className="w-4 h-4 mr-2" />
            관리자 페이지
          </Link>
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={onLogout}
        className="cursor-pointer text-destructive focus:text-destructive"
      >
        <LogOut className="w-4 h-4 mr-2" />
        로그아웃
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const Header = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();

  // No explicit redirect param needed — AuthProvider stashes the current
  // non-auth page in sessionStorage on every navigation, and /login reads
  // that as its fallback redirect target.
  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border"
      >
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="font-serif text-2xl font-semibold text-foreground tracking-tight truncate"
          >
            하우스인어스
          </Link>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/"
              className="editorial-subheading hover:text-primary transition-colors"
            >
              매물 보기
            </Link>
            <Link
              to="/housing-mbti"
              className="editorial-subheading hover:text-primary transition-colors"
              onClick={() => trackCTAClick("start_mbti", "header_nav")}
            >
              주택 MBTI
            </Link>
            <Link
              to="/about"
              className="editorial-subheading hover:text-primary transition-colors"
            >
              소개
            </Link>
            <Link
              to="/blog"
              className="editorial-subheading hover:text-primary transition-colors"
            >
              블로그
            </Link>
            {user ? (
              <UserMenu user={user} isAdmin={isAdmin} onLogout={onLogout} />
            ) : (
              <Link
                to="/login"
                className="editorial-subheading hover:text-primary transition-colors flex items-center gap-1 opacity-0"
              >
                <UserCircle2 className="w-4 h-4" />
                로그인
              </Link>
            )}
          </nav>
          {/* Mobile hamburger */}
          <button
            className="md:hidden text-foreground p-1"
            aria-label="메뉴 열기"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </motion.header>

      {/* Mobile dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />
            {/* Menu panel */}
            <motion.nav
              key="menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="fixed top-[65px] left-0 right-0 z-50 bg-background border-b border-border shadow-lg"
            >
              <div className="flex flex-col">
                <Link
                  to="/"
                  className="px-6 py-4 editorial-subheading hover:bg-secondary/50 transition-colors border-b border-border"
                  onClick={() => setMenuOpen(false)}
                >
                  매물 보기
                </Link>
                <Link
                  to="/housing-mbti"
                  className="px-6 py-4 editorial-subheading hover:bg-secondary/50 transition-colors border-b border-border"
                  onClick={() => {
                    trackCTAClick("start_mbti", "header_nav_mobile");
                    setMenuOpen(false);
                  }}
                >
                  주택 MBTI
                </Link>
                <Link
                  to="/about"
                  className="px-6 py-4 editorial-subheading hover:bg-secondary/50 transition-colors border-b border-border"
                  onClick={() => setMenuOpen(false)}
                >
                  소개
                </Link>
                <Link
                  to="/blog"
                  className="px-6 py-4 editorial-subheading hover:bg-secondary/50 transition-colors border-b border-border"
                  onClick={() => setMenuOpen(false)}
                >
                  블로그
                </Link>
                {user ? (
                  <>
                    <Link
                      to="/me"
                      className="px-6 py-4 editorial-subheading hover:bg-secondary/50 transition-colors border-b border-border flex items-center gap-2"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      계정 관리
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="px-6 py-4 editorial-subheading hover:bg-secondary/50 transition-colors border-b border-border flex items-center gap-2"
                        onClick={() => setMenuOpen(false)}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        관리자 페이지
                      </Link>
                    )}
                    <button
                      type="button"
                      className="px-6 py-4 editorial-subheading hover:bg-secondary/50 transition-colors text-destructive text-left flex items-center gap-2"
                      onClick={() => {
                        setMenuOpen(false);
                        void onLogout();
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                      로그아웃
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    className="px-6 py-4 editorial-subheading hover:bg-secondary/50 transition-colors opacity-0"
                    onClick={() => setMenuOpen(false)}
                  >
                    로그인
                  </Link>
                )}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
