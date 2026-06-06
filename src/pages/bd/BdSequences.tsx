import { AppLayout } from "@/components/layout/AppLayout";
import { BdPlaceholder } from "@/components/bd/BdPlaceholder";
import { Mail } from "lucide-react";

export default function BdSequences() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sequences</h1>
          <p className="text-muted-foreground mt-1">Email cadences that follow up with Leads automatically.</p>
        </div>
        <BdPlaceholder
          title="Sequences"
          sprint={8}
          description="Build multi-step email sequences, enroll Leads, and pause on reply. Templates live in Settings → BD."
          icon={Mail}
        />
      </div>
    </AppLayout>
  );
}
