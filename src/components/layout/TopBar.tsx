import { useEffect, useState } from "react";
import { Menu, Search, LogOut, Settings, Plus, FileText, UserPlus, Building2 } from "lucide-react";
import { ChatSlideOut } from "@/components/chat/ChatSlideOut";
import { Button } from "@/components/ui/button";
import { GlobalSearchDialog } from "@/components/layout/GlobalSearchDialog";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";

interface TopBarProps {
  onMenuToggle?: () => void;
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

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials = getInitials(profile, user?.email);
  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    "User";

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-6">
      {/* Mobile menu button */}
      <Button variant="ghost" size="icon" className="lg:hidden mr-2" onClick={onMenuToggle}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search trigger (opens ⌘K dialog) */}
      <div className="flex-1 max-w-md hidden md:block" data-tour="topbar-search">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-background text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left truncate">Search leads, proposals, clients…</span>
          <kbd className="hidden lg:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Quick Create */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-9" data-tour="topbar-quick-create">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Quick Create</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/proposals?new=1")}>
              <FileText className="h-4 w-4 mr-2" /> New Proposal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/bd/leads?new=1")}>
              <UserPlus className="h-4 w-4 mr-2" /> Capture Lead
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/clients?new=1")}>
              <Building2 className="h-4 w-4 mr-2" /> New Client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Google Chat slide-out */}
        <ChatSlideOut />



        {/* Notifications */}
        <div data-tour="topbar-notifications">
          <NotificationDropdown />
        </div>

        {/* User avatar / dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium truncate">{displayName}</span>
                <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="h-4 w-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
