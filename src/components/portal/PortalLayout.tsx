import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, LogOut, Building2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePortalNotifications } from "@/hooks/usePortal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PortalLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { signOut, profile } = useAuth();
  const { data: notifs = [] } = usePortalNotifications();
  const unread = notifs.filter((n) => !n.read).length;
  const isStaff = profile?.portal_role !== "client";

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/portal" className="flex items-center gap-2 group">
            <div className="h-8 w-8 rounded-md bg-slate-900 text-white flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold leading-tight">Ordino Client Portal</div>
              <div className="text-[10px] text-muted-foreground leading-tight">Green Light Expediting</div>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              to="/portal"
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition",
                isActive("/portal") && !pathname.includes("/notifications")
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              Portfolio
            </Link>
            <Link
              to="/portal/notifications"
              className={cn(
                "relative px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5",
                isActive("/portal/notifications")
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-amber-500 text-[10px] font-semibold text-white flex items-center justify-center">
                  {unread}
                </span>
              )}
            </Link>
            <div className="ml-2 pl-2 border-l flex items-center gap-2">
              <span className="hidden md:inline text-xs text-muted-foreground">
                {profile?.first_name || profile?.display_name || "Signed in"}
              </span>
              <Button variant="ghost" size="sm" onClick={async () => { await signOut(); nav("/auth"); }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>

      <footer className="border-t bg-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between text-xs text-muted-foreground">
          <span>© Green Light Expediting</span>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
