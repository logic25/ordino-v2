import { useState, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  ChevronLeft,
  ChevronRight,
  LogOut,
  FileArchive,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions, type ResourceKey } from "@/hooks/usePermissions";

const mainNav = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard", resource: "dashboard" as ResourceKey },
  { title: "Projects", icon: FolderKanban, href: "/projects", resource: "projects" as ResourceKey },
  { title: "Properties", icon: Building2, href: "/properties", resource: "properties" as ResourceKey },
  { title: "Time", icon: Clock, href: "/time", resource: "time_logs" as ResourceKey },
  { title: "Proposals", icon: FileText, href: "/proposals", resource: "proposals" as ResourceKey },
  { title: "Billing", icon: Receipt, href: "/invoices", resource: "invoices" as ResourceKey },
  { title: "Email", icon: Mail, href: "/emails", resource: "emails" as ResourceKey },
  { title: "Calendar", icon: CalendarDays, href: "/calendar", resource: "calendar" as ResourceKey },
  { title: "RFPs", icon: ScrollText, href: "/rfps", resource: "rfps" as ResourceKey },
];

const secondaryNav = [
  { title: "Companies", icon: Users, href: "/clients", resource: "clients" as ResourceKey },
  { title: "Documents", icon: FileArchive, href: "/documents", resource: "documents" as ResourceKey },
  { title: "Settings", icon: Settings, href: "/settings", resource: "settings" as ResourceKey },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { toast } = useToast();
  const { canAccess, loading: permLoading } = usePermissions();

  const filteredMainNav = useMemo(() =>
    mainNav.filter((item) => canAccess(item.resource)),
    [canAccess]
  );

  const filteredSecondaryNav = useMemo(() =>
    secondaryNav.filter((item) => canAccess(item.resource)),
    [canAccess]
  );

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <aside
      className={cn(
        "sticky top-0 flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 z-30",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-sm">O</span>
          </div>
          {!collapsed && (
            <span className="text-sidebar-foreground font-semibold text-lg tracking-tight">
              Ordino
            </span>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {filteredMainNav.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
          
          return (
            <NavLink
              key={item.href}
              to={item.href}
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

        <Separator className="my-4 bg-sidebar-border" />

        {filteredSecondaryNav.map((item) => {
          const isActive = location.pathname === item.href;
          
          return (
            <NavLink
              key={item.href}
              to={item.href}
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

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 w-full",
            "text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full mt-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed && "px-0"
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="ml-2">Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
