import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { User, Building, Package, ChevronLeft, FileText, Receipt, Zap, Users, ListChecks, ShieldCheck, Radio, Bell, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ServiceCatalogSettings } from "@/components/settings/ServiceCatalogSettings";
import { RfiTemplateSettings } from "@/components/settings/RfiTemplateSettings";
import { InvoiceSettings } from "@/components/settings/InvoiceSettings";
import { AutomationRulesSettings } from "@/components/settings/AutomationRulesSettings";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { CompanySettings } from "@/components/settings/CompanySettings";
import { ListsAndLookupsSettings } from "@/components/settings/ListsAndLookupsSettings";
import { SignalSettings } from "@/components/settings/SignalSettings";
import { PartnerEmailTemplateSettings } from "@/components/settings/PartnerEmailTemplateSettings";
import { InstructionTemplateSettings } from "@/components/settings/InstructionTemplateSettings";
import { RolesSettings } from "@/components/settings/RolesSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { BillingNotificationSettings } from "@/components/settings/BillingNotificationSettings";
import { ReportSettings } from "@/components/settings/ReportSettings";
import { EmailTemplateGallery } from "@/components/settings/EmailTemplateGallery";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { Mail, Brain, ExternalLink, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function BeaconQuickStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["beacon-quick-stats"],
    queryFn: async () => {
      const [{ count: totalQuestions }, { data: confData }, { data: lastRow }] = await Promise.all([
        supabase.from("beacon_interactions").select("*", { count: "exact", head: true }),
        supabase.from("beacon_interactions").select("confidence").not("confidence", "is", null),
        supabase.from("beacon_interactions").select("timestamp").order("timestamp", { ascending: false }).limit(1),
      ]);
      const avgConf = confData && confData.length > 0
        ? Math.round(confData.reduce((s, r) => s + (r.confidence ?? 0), 0) / confData.length)
        : 0;
      const lastActivity = lastRow?.[0]?.timestamp ?? null;
      return { totalQuestions: totalQuestions ?? 0, avgConfidence: avgConf, lastActivity };
    },
    staleTime: 60_000,
  });

  const formatLastActivity = (ts: string | null) => {
    if (!ts) return "—";
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Quick Stats</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 border rounded-lg">
            <p className="text-2xl font-bold">{isLoading ? "…" : (data?.totalQuestions ?? 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Questions</p>
          </div>
          <div className="text-center p-3 border rounded-lg">
            <p className="text-2xl font-bold">{isLoading ? "…" : `${data?.avgConfidence ?? 0}%`}</p>
            <p className="text-xs text-muted-foreground">Avg Confidence</p>
          </div>
          <div className="text-center p-3 border rounded-lg">
            <p className="text-2xl font-bold text-muted-foreground text-sm">{isLoading ? "…" : formatLastActivity(data?.lastActivity ?? null)}</p>
            <p className="text-xs text-muted-foreground">Last Activity</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BeaconSettingsSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-[hsl(142,71%,45%)]" /> Railway Backend
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Connection Status</p>
            <p className="text-xs text-muted-foreground font-mono">https://beaconrag.up.railway.app</p>
            </div>
            <Badge className="bg-[hsl(142,71%,45%)] text-white text-[10px]">Connected</Badge>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Bot Name</p>
              <p className="text-xs text-muted-foreground">Google Chat App</p>
            </div>
            <span className="text-sm font-medium">Beacon</span>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open("https://beaconrag.up.railway.app/dashboard", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" /> Open Beacon Dashboard
          </Button>
        </CardContent>
      </Card>
      <BeaconQuickStats />
    </div>
  );
}

// ── Delete Account Dialog ──────────────────────────────
function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [confirmText, setConfirmText] = useState("");
  const confirmed = confirmText === "DELETE";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setConfirmText(""); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </DialogTitle>
          <DialogDescription>
            This action is <strong>permanent and irreversible</strong>. All company data, projects, clients, invoices, and user accounts will be permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="font-mono"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!confirmed}
            onClick={() => {
              toast.error("Account deletion is not yet implemented. Contact support.");
              onOpenChange(false);
            }}
          >
            Permanently Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SettingsSection = "main" | "profile" | "company" | "proposals" | "rfi_templates" | "invoices" | "automation" | "team" | "lists" | "roles" | "partner_templates" | "signal" | "instruction_templates" | "notifications" | "beacon" | "billing_notifications" | "reports";

interface SettingsSectionDef {
  id: SettingsSection;
  title: string;
  description: string;
  icon: any;
  adminOnly?: boolean;
}

interface SettingsGroup {
  label: string;
  sections: SettingsSectionDef[];
}

const settingsGroups: SettingsGroup[] = [
  {
    label: "Personal",
    sections: [
      { id: "profile", title: "Profile", description: "Your name, phone, hourly rate, and signature", icon: User },
      { id: "notifications", title: "Notifications", description: "Control which alerts you receive and how often", icon: Bell },
    ],
  },
  {
    label: "Organization",
    sections: [
      { id: "company", title: "Company", description: "Organization name, address, logo, and contact info", icon: Building },
      { id: "team", title: "Team & Users", description: "Members, roles, performance, and project assignments", icon: Users },
      { id: "roles", title: "Roles & Permissions", description: "Configure what each role can access", icon: ShieldCheck, adminOnly: true },
    ],
  },
  {
    label: "Workflows & Templates",
    sections: [
      { id: "proposals", title: "Proposals & Services", description: "Service catalog and default terms", icon: Package },
      { id: "invoices", title: "Invoices & Billing", description: "Payment terms, collections, and client billing rules", icon: Receipt },
      { id: "rfi_templates", title: "RFI Templates", description: "Configure client questionnaire forms", icon: FileText },
      { id: "instruction_templates", title: "Instruction Templates", description: "Reusable email templates for DOB instructions", icon: Mail },
      { id: "partner_templates", title: "Partner Outreach Templates", description: "Email templates for RFP partner notifications", icon: Mail },
      { id: "lists", title: "Lists & Lookups", description: "Company types, review categories, and lead sources", icon: ListChecks },
    ],
  },
  {
    label: "Automation & Monitoring",
    sections: [
      { id: "automation", title: "Automation Rules", description: "Auto-reminders, escalations, and collection workflows", icon: Zap },
      { id: "billing_notifications", title: "Billing Notifications", description: "Who gets notified when services are sent to billing", icon: Receipt },
      { id: "signal", title: "Signal Monitoring", description: "Property monitoring preferences and notification rules", icon: Radio },
    ],
  },
  {
    label: "System",
    sections: [
      { id: "reports", title: "Automated Reports", description: "Frequency and settings for the Open Services Report", icon: BarChart3, adminOnly: true },
      { id: "beacon", title: "Beacon AI", description: "Connection status, bot identity, and Beacon dashboard", icon: Brain, adminOnly: true },
    ],
  },
];

const allSections = settingsGroups.flatMap((g) => g.sections);

export default function Settings() {
  const [searchParams] = useSearchParams();
  const { track } = useTelemetry();
  const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
    const section = searchParams.get("section");
    if (section && allSections.some((s) => s.id === section)) {
      return section as SettingsSection;
    }
    return "main";
  });
  const isAdmin = useIsAdmin();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const renderContent = () => {
    switch (activeSection) {
      case "profile": return <ProfileSettings />;
      case "company": return <CompanySettings />;
      case "team": return <TeamSettings />;
      case "proposals": return <ServiceCatalogSettings />;
      case "lists": return <ListsAndLookupsSettings defaultTab={searchParams.get("tab") || undefined} />;
      case "rfi_templates": return <RfiTemplateSettings />;
      case "invoices": return <InvoiceSettings />;
      case "automation": return <AutomationRulesSettings />;
      case "partner_templates": return <PartnerEmailTemplateSettings />;
      case "instruction_templates": return <InstructionTemplateSettings />;
      case "signal": return <SignalSettings />;
      case "roles": return <RolesSettings />;
      case "notifications": return <NotificationSettings />;
      case "beacon": return <BeaconSettingsSection />;
      case "billing_notifications": return <BillingNotificationSettings />;
      case "reports": return <ReportSettings />;
      default:
        return (
          <>
            <div className="space-y-8" data-tour="settings-sections">
              {settingsGroups.map((group) => {
                const visibleSections = group.sections.filter((s) => !s.adminOnly || isAdmin);
                if (visibleSections.length === 0) return null;
                return (
                  <div key={group.label} className="space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                      {group.label}
                    </h2>
                    <div className="grid gap-2">
                      {visibleSections.map((section) => (
                        <Card
                          key={section.id}
                          className="card-hover cursor-pointer"
                          onClick={() => {
                            track("settings", "tab_viewed", { tab: section.id });
                            setActiveSection(section.id);
                          }}
                        >
                          <CardContent className="flex items-center gap-4 p-4">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <section.icon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm">{section.title}</h3>
                              <p className="text-xs text-muted-foreground truncate">{section.description}</p>
                            </div>
                            <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180 shrink-0" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {isAdmin && (
              <>
                <Separator />
                <Card className="border-destructive/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Danger Zone
                    </CardTitle>
                    <CardDescription className="text-xs">Irreversible and destructive actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                      Delete Account
                    </Button>
                  </CardContent>
                </Card>
                <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
              </>
            )}
          </>
        );
    }
  };

  const currentSection = allSections.find((s) => s.id === activeSection);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in" data-tour="settings-page">
        <div className="flex items-center gap-4" data-tour="settings-header">
          {activeSection !== "main" && (
            <Button variant="ghost" size="icon" onClick={() => setActiveSection("main")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {currentSection ? currentSection.title : "Settings"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {currentSection ? currentSection.description : "Manage your account and preferences"}
            </p>
          </div>
        </div>
        {renderContent()}
      </div>
    </AppLayout>
  );
}
