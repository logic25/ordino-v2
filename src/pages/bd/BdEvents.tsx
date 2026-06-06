import { AppLayout } from "@/components/layout/AppLayout";
import { BdPlaceholder } from "@/components/bd/BdPlaceholder";
import { Calendar } from "lucide-react";

export default function BdEvents() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground mt-1">Industry events with approval workflow and attendee tracking.</p>
        </div>
        <BdPlaceholder
          title="Events"
          sprint={6}
          description="Propose events for approval, register attendees, and link Leads captured at each event. Includes the Activity thread for team commentary."
          icon={Calendar}
        />
      </div>
    </AppLayout>
  );
}
