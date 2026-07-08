import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicLinkForm } from "@/pages/Auth";

export default function PortalAuth() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Client Portal</CardTitle>
            <CardDescription>
              Enter the email address that received the invite and we’ll send you a secure sign-in link.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <MagicLinkForm redirectPath="/portal" />
          <p className="text-center text-xs text-muted-foreground">
            Green Light team member? <Link to="/auth" className="font-medium text-foreground hover:underline">Use staff sign-in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}