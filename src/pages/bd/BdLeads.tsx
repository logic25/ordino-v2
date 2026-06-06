import { AppLayout } from "@/components/layout/AppLayout";
import { BdPlaceholder } from "@/components/bd/BdPlaceholder";
import { Users } from "lucide-react";

export default function BdLeads() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-1">Track every potential new client end-to-end.</p>
        </div>
        <BdPlaceholder
          title="Leads"
          sprint={2}
          description="A sortable, filterable grid of every Lead with capture modal, owner assignment, and stage tracking. Builds on the BD schema shipped in Sprint 1."
          icon={Users}
        />
      </div>
    </AppLayout>
  );
}
