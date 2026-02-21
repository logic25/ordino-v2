import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, FolderKanban, FileText, Receipt, Clock, Mail, ScrollText, Settings, Building2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface Guide {
  title: string;
  icon: React.ElementType;
  items: { title: string; steps: string[] }[];
}

const GUIDES: Guide[] = [
  {
    title: "Projects",
    icon: FolderKanban,
    items: [
      { title: "Create a new project", steps: ["Go to Projects page", "Click '+ New Project'", "Fill in property, client, and service details", "Assign a PM and save"] },
      { title: "Use the project checklist", steps: ["Open a project detail page", "Switch to the Checklist tab", "Check off items as they're completed", "Track overall readiness percentage"] },
      { title: "Submit for billing", steps: ["Open a project", "Click 'Send to Billing'", "Select services to bill", "Add notes and submit"] },
    ],
  },
  {
    title: "Proposals",
    icon: FileText,
    items: [
      { title: "Create and send a proposal", steps: ["Go to Proposals", "Click '+ New Proposal'", "Add services from the catalog", "Preview and send to client"] },
      { title: "Track proposal follow-ups", steps: ["Sent proposals show follow-up dates", "Dismiss or snooze reminders", "Log follow-up activities"] },
    ],
  },
  {
    title: "Billing & Invoices",
    icon: Receipt,
    items: [
      { title: "Create an invoice", steps: ["Go to Billing page", "Click 'Create Invoice'", "Select project and services", "Set payment terms and send"] },
      { title: "Track collections", steps: ["Switch to Collections tab", "View overdue invoices", "Record payment promises", "Send collection reminders"] },
    ],
  },
  {
    title: "Time Tracking",
    icon: Clock,
    items: [
      { title: "Log time entries", steps: ["Go to Time page", "Click '+ Log Time'", "Select project and describe work", "Mark as billable if applicable"] },
      { title: "Clock in/out", steps: ["Use the clock button in the top bar", "Add notes when clocking out", "View attendance history in Time page"] },
    ],
  },
  {
    title: "Email",
    icon: Mail,
    items: [
      { title: "Connect Gmail", steps: ["Go to Email page", "Click 'Connect Gmail'", "Authorize access", "Emails sync automatically"] },
      { title: "Tag and organize emails", steps: ["Open an email", "Use quick tags to categorize", "Link emails to projects or clients", "Add internal notes"] },
    ],
  },
  {
    title: "RFPs",
    icon: ScrollText,
    items: [
      { title: "Track RFP opportunities", steps: ["Go to RFPs page", "Add new RFP manually or discover them", "Move through pipeline stages", "Build response documents"] },
    ],
  },
  {
    title: "Properties & Clients",
    icon: Building2,
    items: [
      { title: "Add a property", steps: ["Go to Properties page", "Click '+ New Property'", "Enter address and details", "Link to projects as needed"] },
      { title: "Manage client contacts", steps: ["Go to Companies page", "Click into a client", "Add contacts with roles", "Set primary billing contact"] },
    ],
  },
  {
    title: "Settings",
    icon: Settings,
    items: [
      { title: "Configure service catalog", steps: ["Go to Settings > Proposals & Services", "Click '+ Add Service' to open the modal", "Fill in name, description, fee type, and price", "Set multiplier and complexity weight (see guides below)", "Save changes"] },
      { title: "How to set the Multiplier", steps: [
        "The multiplier scales the base price when a service covers multiple units (floors, disciplines, etc.)",
        "Example: A 'DOB Filing' costs $500 base. If the project has 3 disciplines and the multiplier is 1.5, the price adjusts to $500 × 1.5 × 3 = $2,250",
        "Set to 0 or leave blank if the service is always a flat fee regardless of scope",
        "Common values: 1.0 (no scaling), 1.25–1.5 (moderate scaling per unit), 2.0+ (heavy per-unit scaling)",
      ]},
      { title: "How to set Complexity Weight", steps: [
        "Complexity weight (1–10) tells the dashboard how much PM bandwidth a service consumes",
        "1–2: Simple tasks like document pickups, basic filings, or letter-of-completion requests",
        "3–5: Standard services like DOB filings, plan reviews, or objection responses",
        "6–8: Complex services like full building alt-1 filings, multiple inspections, or coordinated multi-agency submissions",
        "9–10: Major projects like full building new-build filings or litigation support packages",
        "The PM capacity tracker multiplies this weight by the number of active projects using the service to calculate workload",
      ]},
      { title: "Set up notification preferences", steps: ["Go to Settings > Notifications", "Toggle categories on/off", "Choose frequency (Realtime/Daily/Weekly)", "Save preferences"] },
    ],
  },
];

export function HowToGuides() {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();

  const filtered = GUIDES.map((g) => ({
    ...g,
    items: g.items.filter(
      (i) => i.title.toLowerCase().includes(q) || i.steps.some((s) => s.toLowerCase().includes(q))
    ),
  })).filter((g) => g.items.length > 0 || g.title.toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search guides..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No guides match your search.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((guide) => (
            <Card key={guide.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <guide.icon className="h-4 w-4 text-muted-foreground" />
                  {guide.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {guide.items.map((item) => (
                  <Collapsible key={item.title}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium hover:text-primary transition-colors py-1">
                      {item.title}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1 pl-2 pt-1 pb-2">
                        {item.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
