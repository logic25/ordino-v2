import { useState, useMemo, useCallback } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2,
  FileText,
  Clock,
  Users,
  Settings,
  LayoutDashboard,
  FolderKanban,
  Receipt,
  Mail,
  CalendarDays,
  
  LogOut,
  FileArchive,
  ScrollText,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  MessageSquare,
  ChevronDown,
  Globe2,
  Camera,
  ClipboardList,
  QrCode,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions, type ResourceKey } from "@/hooks/usePermissions";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { useUnreadIndicators } from "@/hooks/useUnreadIndicators";

type NavItem = { title: string; icon: any; href: string; resource: ResourceKey };
type NavGroup = { kind: "group"; label: string; items: NavItem[] };
type NavEntry = NavItem | NavGroup;

const mainNav: NavEntry[] = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard", resource: "dashboard" as ResourceKey },
  { title: "Projects", icon: FolderKanban, href: "/projects", resource: "projects" as ResourceKey },
  { title: "Properties", icon: Building2, href: "/properties", resource: "properties" as ResourceKey },
  { title: "Time", icon: Clock, href: "/time", resource: "time_logs" as ResourceKey },
  { title: "Proposals", icon: FileText, href: "/proposals", resource: "proposals" as ResourceKey },
  {
    kind: "group",
    label: "BD",
    items: [
      { title: "Leads", icon: Users, href: "/bd/leads", resource: "proposals" as ResourceKey },
      
      { title: "Events", icon: CalendarDays, href: "/bd/events", resource: "proposals" as ResourceKey },
      { title: "Sequences", icon: Mail, href: "/bd/sequences", resource: "proposals" as ResourceKey },
      { title: "Markets", icon: Globe2, href: "/markets", resource: "proposals" as ResourceKey },
      { title: "Event Card", icon: QrCode, href: "/bd/event-card", resource: "proposals" as ResourceKey },
    ],
  },
  { title: "Billing", icon: Receipt, href: "/invoices", resource: "invoices" as ResourceKey },
  { title: "Email", icon: Mail, href: "/emails", resource: "emails" as ResourceKey },
  { title: "Calendar", icon: CalendarDays, href: "/calendar", resource: "calendar" as ResourceKey },
  { title: "RFPs", icon: ScrollText, href: "/rfps", resource: "rfps" as ResourceKey },
  { title: "Chat", icon: MessageSquare, href: "/chat", resource: "dashboard" as ResourceKey },
  { title: "Content", icon: Sparkles, href: "/content", resource: "dashboard" as ResourceKey },
  { title: "Reports", icon: BarChart3, href: "/reports", resource: "reports" as ResourceKey },
];

const secondaryNav = [
  { title: "Companies", icon: Users, href: "/clients", resource: "clients" as ResourceKey },
  { title: "Documents", icon: FileArchive, href: "/documents", resource: "documents" as ResourceKey },
  { title: "Settings", icon: Settings, href: "/settings", resource: "settings" as ResourceKey },
  { title: "Help", icon: HelpCircle, href: "/help", resource: "dashboard" as ResourceKey },
];


// Prefetch map: route path → lazy import function
const routePrefetchMap: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("@/pages/Dashboard"),
  "/projects": () => import("@/pages/Projects"),
  "/properties": () => import("@/pages/Properties"),
  "/time": () => import("@/pages/Time"),
  "/proposals": () => import("@/pages/Proposals"),
  "/bd/leads": () => import("@/pages/bd/BdLeads"),
  "/bd/leads/:id": () => import("@/pages/bd/BdLeadDetail"),
  "/bd/events": () => import("@/pages/bd/BdEvents"),
  "/bd/sequences": () => import("@/pages/bd/BdSequences"),
  "/bd/follow-ups": () => import("@/pages/bd/BdFollowUps"),
  "/markets": () => import("@/pages/MarketsHub"),
  "/bd/event-card": () => import("@/pages/bd/BdEventCard"),
  "/bd/events/:id": () => import("@/pages/bd/BdEventDetail"),
  "/invoices": () => import("@/pages/Invoices"),
  "/emails": () => import("@/pages/Emails"),
  "/calendar": () => import("@/pages/Calendar"),
  "/rfps": () => import("@/pages/Rfps"),
  "/chat": () => import("@/pages/Chat"),
  "/reports": () => import("@/pages/Reports"),
  "/content": () => import("@/pages/Content"),
  "/clients": () => import("@/pages/Clients"),
  "/documents": () => import("@/pages/Documents"),
  "/settings": () => import("@/pages/Settings"),
  "/help": () => import("@/pages/HelpDesk"),
  "/beacon": () => import("@/pages/BeaconHub"),
};

const prefetchedRoutes = new Set<string>();

function prefetchRoute(href: string) {
  if (prefetchedRoutes.has(href)) return;
  const loader = routePrefetchMap[href];
  if (loader) {
    prefetchedRoutes.add(href);
    loader();
  }
}

function getInitials(profile: any, email?: string | null): string {
  const first = profile?.first_name?.trim();
  const last = profile?.last_name?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (profile?.display_name) return profile.display_name.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const { toast } = useToast();
  const { canAccess, loading: permLoading } = usePermissions();
  const { user, profile, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const { chatHasUnread, emailHasUnread, emailUnreadCount, billingPendingCount } = useUnreadIndicators();

  const unreadDotMap: Record<string, boolean> = {
    "/chat": chatHasUnread,
  };

  const unreadCountMap: Record<string, number> = {
    "/emails": emailUnreadCount,
    "/invoices": billingPendingCount,
  };

  const filteredMainNav = useMemo<NavEntry[]>(() =>
    mainNav.reduce<NavEntry[]>((acc, entry) => {
      if ("kind" in entry && entry.kind === "group") {
        const items = entry.items.filter((i) => canAccess(i.resource));
        if (items.length > 0) acc.push({ ...entry, items });
      } else if (canAccess((entry as NavItem).resource)) {
        acc.push(entry);
      }
      return acc;
    }, []),
    [canAccess]
  );

  const filteredSecondaryNav = useMemo(
    () => secondaryNav.filter((item) => canAccess(item.resource)),
    [canAccess]
  );

  const initials = getInitials(profile, user?.email);
  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    "User";

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        "sticky top-0 flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 z-30",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo + Collapse Toggle */}
      <div className={cn(
        "flex items-center h-16 border-b border-sidebar-border",
        collapsed ? "justify-center gap-0 px-2" : "justify-between px-4"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-sm">O</span>
            </div>
            <span className="text-sidebar-foreground font-semibold text-lg tracking-tight">
              Ordino
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1.5 rounded-md hover:bg-sidebar-accent"
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {(() => {
          const renderItem = (item: NavItem, opts?: { indented?: boolean }) => {
            const isActive = location.pathname === item.href ||
              (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={onNavigate}
                onMouseEnter={() => prefetchRoute(item.href)}
                data-tour={`nav-${item.href.replace("/", "")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                  "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                  isActive && "bg-sidebar-accent text-sidebar-foreground font-medium",
                  collapsed && "justify-center px-2",
                  opts?.indented && !collapsed && "ml-2"
                )}
              >
                <span className="relative flex-shrink-0">
                  <item.icon className={cn("h-5 w-5", isActive && "text-sidebar-primary")} />
                  {unreadCountMap[item.href] > 0 ? (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-sidebar px-1">
                      {unreadCountMap[item.href] > 99 ? "99+" : unreadCountMap[item.href]}
                    </span>
                  ) : unreadDotMap[item.href] ? (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar" />
                  ) : null}
                </span>
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            );
          };

          return filteredMainNav.map((entry, idx) => {
            if ("kind" in entry && entry.kind === "group") {
              if (collapsed) {
                return (
                  <div key={`group-${entry.label}-${idx}`} className="space-y-1">
                    <Separator className="my-2 bg-sidebar-border" />
                    {entry.items.map((i) => renderItem(i))}
                  </div>
                );
              }
              const groupActive = entry.items.some((i) =>
                location.pathname === i.href || location.pathname.startsWith(i.href)
              );
              const isOpen = openGroups[entry.label] ?? groupActive ?? true;
              return (
                <div key={`group-${entry.label}-${idx}`} className="pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((s) => ({ ...s, [entry.label]: !isOpen }))
                    }
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                      "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <span>{entry.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        !isOpen && "-rotate-90"
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="space-y-1 border-l border-sidebar-border/60 ml-3 pl-1 mt-1">
                      {entry.items.map((i) => renderItem(i, { indented: true }))}
                    </div>
                  )}
                </div>
              );
            }
            return renderItem(entry as NavItem);
          });
        })()}


        <Separator className="my-4 bg-sidebar-border" />

        {filteredSecondaryNav.map((item) => {
          const isActive = location.pathname === item.href;
          
          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              onMouseEnter={() => prefetchRoute(item.href)}
              data-tour={`nav-${item.href.replace("/", "")}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                isActive && "bg-sidebar-accent text-sidebar-foreground font-medium",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-sidebar-primary")} />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          );
        })}

      </nav>

      {/* Footer — user avatar */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => signOut()}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 w-full",
            "text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10",
            collapsed && "justify-center px-2"
          )}
          title="Sign out"
        >
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 text-primary-foreground font-semibold text-xs">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">Sign out</p>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
