import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, User, Building, Package, ChevronLeft, FileText, Receipt, Zap, Users, ListChecks, ShieldCheck } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ServiceCatalogSettings } from "@/components/settings/ServiceCatalogSettings";
import { RfiTemplateSettings } from "@/components/settings/RfiTemplateSettings";
import { InvoiceSettings } from "@/components/settings/InvoiceSettings";
import { AutomationRulesSettings } from "@/components/settings/AutomationRulesSettings";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { CompanySettings } from "@/components/settings/CompanySettings";
import { ListsAndLookupsSettings } from "@/components/settings/ListsAndLookupsSettings";
import { PartnerEmailTemplateSettings } from "@/components/settings/PartnerEmailTemplateSettings";
import { RolesSettings } from "@/components/settings/RolesSettings";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { Mail } from "lucide-react";

type SettingsSection = "main" | "profile" | "company" | "proposals" | "rfi_templates" | "invoices" | "automation" | "team" | "lists" | "roles" | "partner_templates";

const settingsSections = [
  {
    id: "profile" as const,
    title: "Profile",
    description: "Your personal information, hourly rate, and signature",
    icon: User,
  },
  {
    id: "company" as const,
    title: "Company",
    description: "Organization name, address, logo, and contact info",
    icon: Building,
  },
  {
    id: "team" as const,
    title: "Team & Users",
    description: "View team members, roles, proposals, and project assignments",
    icon: Users,
  },
  {
    id: "proposals" as const,
    title: "Proposals & Services",
    description: "Service catalog and default terms",
    icon: Package,
  },
  {
    id: "lists" as const,
    title: "Lists & Lookups",
    description: "Company types, review categories, and lead sources",
    icon: ListChecks,
  },
  {
    id: "rfi_templates" as const,
    title: "RFI Templates",
    description: "Configure client questionnaire forms",
    icon: FileText,
  },
  {
    id: "invoices" as const,
    title: "Invoices & Billing",
    description: "Payment terms, collections timeline, and client billing rules",
    icon: Receipt,
  },
  {
    id: "automation" as const,
    title: "Automation Rules",
    description: "Configure auto-reminders, escalations, and collection workflows",
    icon: Zap,
  },
  {
    id: "partner_templates" as const,
    title: "Partner Outreach Templates",
    description: "Email templates for RFP partner notifications",
    icon: Mail,
  },
  {
    id: "roles" as const,
    title: "Roles & Permissions",
    description: "Configure what each role can access across the system",
    icon: ShieldCheck,
    adminOnly: true,
  },
];

export default function Settings() {
  const [searchParams] = useSearchParams();
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
      case "profile":
        return <ProfileSettings />;
      case "company":
        return <CompanySettings />;
      case "team":
        return <TeamSettings />;
      case "proposals":
        return <ServiceCatalogSettings />;
      case "lists":
        return <ListsAndLookupsSettings defaultTab={searchParams.get("tab") || undefined} />;
      case "rfi_templates":
        return <RfiTemplateSettings />;
      case "invoices":
        return <InvoiceSettings />;
      case "automation":
        return <AutomationRulesSettings />;
      case "partner_templates":
        return <PartnerEmailTemplateSettings />;
      case "roles":
        return <RolesSettings />;
      default:
        return (
          <>
            <div className="grid gap-4">
              {settingsSections
                .filter((section) => !(section as any).adminOnly || isAdmin)
                .map((section) => (
                <Card
                  key={section.id}
                  className="card-hover cursor-pointer"
                  onClick={() => setActiveSection(section.id)}
                >
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <section.icon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{section.title}</h3>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      Configure
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Separator />

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible and destructive actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </>
        );
    }
  };

  const currentSection = settingsSections.find((s) => s.id === activeSection);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          {activeSection !== "main" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveSection("main")}
            >
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
