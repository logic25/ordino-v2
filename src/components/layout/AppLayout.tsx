import { ReactNode, useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { ClockOutModal } from "@/components/time/ClockOutModal";
import { BeaconChatWidget } from "@/components/beacon/BeaconChatWidget";
import type { BeaconProjectContext } from "@/services/beaconApi";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isOnChatPage = location.pathname === "/chat";

  // Extract project ID from route
  const projectId = useMemo(() => {
    const match = location.pathname.match(/^\/projects\/([0-9a-f-]{36})/);
    return match ? match[1] : undefined;
  }, [location.pathname]);

  // Fetch project data for Beacon context when on a project page
  const { data: projectData } = useQuery({
    queryKey: ["beacon-project-context", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          id, name, project_number, filing_type, floor_number, notes, estimated_job_cost,
          properties (address, borough, block, lot),
          services:services (name, status, total_amount, billed_amount),
          dob_applications:dob_applications (job_number, filing_type, status),
          clients:clients (name)
        `)
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const projectContext = useMemo<BeaconProjectContext | undefined>(() => {
    if (!projectId) return undefined;
    if (!projectData) return { projectId };
    const prop = (projectData as any).properties;
    const services = ((projectData as any).services || []) as { name: string; status: string; total_amount: number; billed_amount: number }[];
    const apps = ((projectData as any).dob_applications || []) as { job_number: string; filing_type: string; status: string }[];
    const client = (projectData as any).clients;

    const contractValue = services.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    const billedAmount = services.reduce((sum, s) => sum + (Number(s.billed_amount) || 0), 0);

    return {
      projectId,
      projectName: projectData.name || undefined,
      projectNumber: (projectData as any).project_number || undefined,
      projectAddress: prop?.address || undefined,
      borough: prop?.borough || undefined,
      block: prop?.block || undefined,
      lot: prop?.lot || undefined,
      filingType: (projectData as any).filing_type || undefined,
      scopeOfWork: projectData.notes || undefined,
      assignedServices: services.map((s) => s.name).filter(Boolean),
      contractValue: contractValue || undefined,
      billedAmount: billedAmount || undefined,
      serviceDetails: services.map((s) => `${s.name} (${s.status}, $${Number(s.total_amount) || 0})`),
      dobApplications: apps.map((a) => `${a.job_number || 'No job#'} - ${a.filing_type || 'N/A'} (${a.status || 'pending'})`),
      clientName: client?.name || undefined,
    };
  }, [projectId, projectData]);

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
      {!isOnChatPage && <BeaconChatWidget projectContext={projectContext} />}
    </>
  );
}
