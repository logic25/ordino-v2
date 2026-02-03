import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, User, Building, Bell, CreditCard, Shield } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const settingsSections = [
  {
    title: "Profile",
    description: "Your personal information and preferences",
    icon: User,
  },
  {
    title: "Company",
    description: "Organization settings and team management",
    icon: Building,
  },
  {
    title: "Notifications",
    description: "Email, push, and in-app notifications",
    icon: Bell,
  },
  {
    title: "Billing",
    description: "Subscription and payment settings",
    icon: CreditCard,
  },
  {
    title: "Security",
    description: "Password, 2FA, and session management",
    icon: Shield,
  },
];

export default function Settings() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account and preferences
          </p>
        </div>

        <div className="grid gap-4">
          {settingsSections.map((section) => (
            <Card key={section.title} className="card-hover cursor-pointer">
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
      </div>
    </AppLayout>
  );
}
