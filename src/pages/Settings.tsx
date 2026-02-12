import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, User, Building, Bell, CreditCard, Shield, Package, ChevronLeft, FileText, Tags } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ServiceCatalogSettings } from "@/components/settings/ServiceCatalogSettings";
import { RfiTemplateSettings } from "@/components/settings/RfiTemplateSettings";
import { CompanyTypeSettings } from "@/components/settings/CompanyTypeSettings";

type SettingsSection = "main" | "profile" | "company" | "proposals" | "company_types" | "rfi_templates" | "notifications" | "billing" | "security";

const settingsSections = [
  {
    id: "profile" as const,
    title: "Profile",
    description: "Your personal information and preferences",
    icon: User,
  },
  {
    id: "company" as const,
    title: "Company",
    description: "Organization settings and team management",
    icon: Building,
  },
  {
    id: "proposals" as const,
    title: "Proposals & Services",
    description: "Service catalog and default terms",
    icon: Package,
  },
  {
    id: "company_types" as const,
    title: "Company Types",
    description: "Define types like Architect, Plumber, GC for sorting and filtering",
    icon: Tags,
  },
  {
    id: "rfi_templates" as const,
    title: "RFI Templates",
    description: "Configure client questionnaire forms",
    icon: FileText,
  },
  {
    id: "notifications" as const,
    title: "Notifications",
    description: "Email, push, and in-app notifications",
    icon: Bell,
  },
  {
    id: "billing" as const,
    title: "Billing",
    description: "Subscription and payment settings",
    icon: CreditCard,
  },
  {
    id: "security" as const,
    title: "Security",
    description: "Password, 2FA, and session management",
    icon: Shield,
  },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("main");

  const renderContent = () => {
    switch (activeSection) {
      case "proposals":
        return <ServiceCatalogSettings />;
      case "company_types":
        return <CompanyTypeSettings />;
      case "rfi_templates":
        return <RfiTemplateSettings />;
      case "profile":
      case "company":
      case "notifications":
      case "billing":
      case "security":
        return (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} settings coming soon.
              </p>
            </CardContent>
          </Card>
        );
      default:
        return (
          <>
            <div className="grid gap-4">
              {settingsSections.map((section) => (
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
