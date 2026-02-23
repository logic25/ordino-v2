import { useState, useEffect } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, User, Building, Package, ChevronLeft, FileText, Receipt, Zap, Users, ListChecks, ShieldCheck, Radio, Bell } from "lucide-react";
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
import { useIsAdmin } from "@/hooks/useUserRoles";
import { Mail, Brain, Bot, Hash, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { mockBeaconSpaces } from "@/lib/beaconMockData";

function BeaconSettingsSection() {
  const [cardSettings, setCardSettings] = useState({
    sourceAttribution: true,
    confidenceIndicator: true,
    actionButtons: true,
    propertyDataCard: true,
    relatedBBs: true,
    filingChecklist: true,
  });

  const apis = [
    { name: "Anthropic (Claude)", status: "Connected", detail: "Model: claude-haiku-4-5-20251001" },
    { name: "Pinecone", status: "Connected", detail: "Index: beacon-docs" },
    { name: "Voyage AI", status: "Connected", detail: "Model: voyage-2, Dimensions: 1024" },
    { name: "Railway", status: "Connected", detail: "Beacon backend deployment" },
    { name: "Google Chat", status: "Connected", detail: "Bot name: Beacon" },
  ];

  return (
    <div className="space-y-6">
      {/* API Connections */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4 text-[#22c55e]" /> API Connections</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {apis.map(a => (
            <div key={a.name} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.detail}</p>
              </div>
              <Badge className="bg-[#22c55e] text-white text-[10px]">{a.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Knowledge Base Settings */}
      <Card>
        <CardHeader><CardTitle className="text-base">Knowledge Base Settings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1"><Label className="text-xs">Index Name</Label><Input value="beacon-docs" disabled /></div>
          <div className="space-y-1"><Label className="text-xs">Embedding Model</Label><Input value="voyage-2" disabled /></div>
          <div className="space-y-1"><Label className="text-xs">Chunk Size</Label><Input value="512 tokens" disabled /></div>
          <div className="space-y-1"><Label className="text-xs">Min Relevance Score</Label><Input value="0.55" disabled /></div>
          <div className="space-y-1"><Label className="text-xs">Max History Length</Label><Input value="10" disabled /></div>
        </CardContent>
      </Card>

      {/* Bot Identity */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4" /> Bot Identity</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Display Name</Label>
              <Input value="Beacon" disabled />
              <p className="text-[10px] text-muted-foreground">Configure in Google Cloud Console → Chat API</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Avatar URL</Label>
              <Input placeholder="https://..." />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Template Settings */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><SettingsIcon className="h-4 w-4" /> Card Template Settings</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(cardSettings).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between p-2 rounded border">
                <Label className="text-sm capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</Label>
                <Switch checked={val} onCheckedChange={(v) => setCardSettings(prev => ({ ...prev, [key]: v }))} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Space Management */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Hash className="h-4 w-4" /> Active Spaces</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Space</th>
                  <th className="text-left p-3 font-medium">Members</th>
                  <th className="text-left p-3 font-medium">Questions</th>
                  <th className="text-left p-3 font-medium">Top Topics</th>
                </tr>
              </thead>
              <tbody>
                {mockBeaconSpaces.map((s, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">{s.members}</td>
                    <td className="p-3">{s.questions}</td>
                    <td className="p-3"><div className="flex gap-1">{s.top_topics.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Team Usage */}
      <Card>
        <CardHeader><CardTitle className="text-base">Team Usage</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="text-left p-3 font-medium">User</th><th className="text-left p-3 font-medium">Questions</th><th className="text-left p-3 font-medium">Corrections</th><th className="text-left p-3 font-medium">Suggestions</th></tr></thead>
              <tbody>
                {[{ name: "Chris Henry", q: 245, c: 5, s: 2 }, { name: "Justin", q: 189, c: 3, s: 3 }, { name: "Manny", q: 156, c: 4, s: 3 }].map(u => (
                  <tr key={u.name} className="border-t"><td className="p-3">{u.name}</td><td className="p-3">{u.q}</td><td className="p-3">{u.c}</td><td className="p-3">{u.s}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Access & Discovery */}
      <Card className="border-[#22c55e]/30">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-[#22c55e]" /> Access & Discovery</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>To make Beacon discoverable by all team members:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Go to Google Cloud Console → Chat API → Configuration</li>
            <li>Set visibility to "Available to everyone in your organization"</li>
            <li>Ensure the app is published to your Google Workspace domain</li>
          </ol>
          <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
            <strong>Note:</strong> Google Chat does not fully index bot messages in search. The Ordino Conversations page serves as the searchable archive for all Beacon interactions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

type SettingsSection = "main" | "profile" | "company" | "proposals" | "rfi_templates" | "invoices" | "automation" | "team" | "lists" | "roles" | "partner_templates" | "signal" | "instruction_templates" | "notifications" | "beacon";

const settingsSections = [
  { id: "profile" as const, title: "Profile", description: "Your personal information, hourly rate, and signature", icon: User },
  { id: "notifications" as const, title: "Notifications", description: "Control which alerts you receive and how often", icon: Bell },
  { id: "company" as const, title: "Company", description: "Organization name, address, logo, and contact info", icon: Building },
  { id: "team" as const, title: "Team & Users", description: "View team members, roles, proposals, and project assignments", icon: Users },
  { id: "proposals" as const, title: "Proposals & Services", description: "Service catalog and default terms", icon: Package },
  { id: "lists" as const, title: "Lists & Lookups", description: "Company types, review categories, and lead sources", icon: ListChecks },
  { id: "rfi_templates" as const, title: "RFI Templates", description: "Configure client questionnaire forms", icon: FileText },
  { id: "instruction_templates" as const, title: "Instruction Templates", description: "Reusable email templates for DOB instructions", icon: Mail },
  { id: "invoices" as const, title: "Invoices & Billing", description: "Payment terms, collections timeline, and client billing rules", icon: Receipt },
  { id: "automation" as const, title: "Automation Rules", description: "Configure auto-reminders, escalations, and collection workflows", icon: Zap },
  { id: "partner_templates" as const, title: "Partner Outreach Templates", description: "Email templates for RFP partner notifications", icon: Mail },
  { id: "signal" as const, title: "Signal Monitoring", description: "Configure property monitoring preferences and notification rules", icon: Radio },
  { id: "roles" as const, title: "Roles & Permissions", description: "Configure what each role can access across the system", icon: ShieldCheck, adminOnly: true },
  { id: "beacon" as const, title: "Beacon AI", description: "API connections, bot identity, card templates, knowledge base, and space management", icon: Brain, adminOnly: true },
];

export default function Settings() {
  const [searchParams] = useSearchParams();
  const { track } = useTelemetry();
  const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
    const section = searchParams.get("section");
    if (section && settingsSections.some((s) => s.id === section)) {
      return section as SettingsSection;
    }
    return "main";
  });
  const isAdmin = useIsAdmin();

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
      default:
        return (
          <>
            <div className="grid gap-4" data-tour="settings-sections">
              {settingsSections
                .filter((section) => !(section as any).adminOnly || isAdmin)
                .map((section) => (
                <Card
                  key={section.id}
                  className="card-hover cursor-pointer"
                  onClick={() => {
                    track("settings", "tab_viewed", { tab: section.id });
                    setActiveSection(section.id);
                  }}
                >
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <section.icon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{section.title}</h3>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                    <Button variant="ghost" size="sm">Configure</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Separator />
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible and destructive actions</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" size="sm">Delete Account</Button>
              </CardContent>
            </Card>
          </>
        );
    }
  };

  const currentSection = settingsSections.find((s) => s.id === activeSection);

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
