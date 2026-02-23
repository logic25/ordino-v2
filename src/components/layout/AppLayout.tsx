import { ReactNode, useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { ClockOutModal } from "@/components/time/ClockOutModal";
import { AskOrdinoButton } from "@/components/assistant/AskOrdinoButton";
import { AskOrdinoPanel } from "@/components/assistant/AskOrdinoPanel";
import { useAskOrdino } from "@/hooks/useAskOrdino";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const ordino = useAskOrdino();

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        ordino.setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
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
      </div>

      <ClockOutModal />

      {/* Ask Ordino */}
      {!ordino.isOpen && <AskOrdinoButton onClick={() => ordino.setIsOpen(true)} />}
      <AskOrdinoPanel
        isOpen={ordino.isOpen}
        onClose={() => ordino.setIsOpen(false)}
        messages={ordino.messages}
        isLoading={ordino.isLoading}
        onAsk={ordino.ask}
        onClear={ordino.clear}
      />
    </div>
  );
}
