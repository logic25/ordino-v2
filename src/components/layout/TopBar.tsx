import { LogOut, Menu, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";

interface TopBarProps {
  onMenuToggle?: () => void;
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-6">
      {/* Mobile menu button */}
      <Button variant="ghost" size="icon" className="lg:hidden mr-2" onClick={onMenuToggle}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search */}
      <div className="flex-1 max-w-md hidden sm:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search projects, properties, clients..."
            className="pl-9 bg-background border-border"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <NotificationDropdown />

        {/* Logout */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => signOut()}>
              <LogOut className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{user?.email || "User"}</span>
                <span className="text-xs text-muted-foreground">Project Manager</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
