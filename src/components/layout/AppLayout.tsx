import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { ClockOutModal } from "@/components/time/ClockOutModal";
import { BeaconChatWidget } from "@/components/beacon/BeaconChatWidget";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isOnChatPage = location.pathname === "/chat";

  return (
    <>
      <div className="flex min-h-screen w-full bg-background">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 lg:static lg:z-auto
          transform transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}>
          <AppSidebar onNavigate={() => setMobileOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onMenuToggle={() => setMobileOpen((v) => !v)} />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
          <footer className="border-t border-border px-4 py-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </footer>
        </div>

        <ClockOutModal />
      </div>

      {/* Beacon floating chat widget - hidden on /chat to avoid duplicate messages */}
      {!isOnChatPage && <BeaconChatWidget />}
    </>
  );
}
