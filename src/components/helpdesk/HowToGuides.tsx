import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, FolderKanban, FileText, Receipt, Clock, Mail, ScrollText, Settings, Building2, Lightbulb, AlertTriangle, ArrowRight, Filter } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

type Role = "pm" | "admin" | "accounting" | "all";

interface GuideStep {
  text: string;
  tip?: string;
  warning?: string;
}

interface GuideItem {
  title: string;
  steps: (string | GuideStep)[];
  roles: Role[];
  relatedGuides?: string[];
}

interface Guide {
  title: string;
  icon: React.ElementType;
  items: GuideItem[];
}

const ROLE_STYLES: Record<Role, { label: string; className: string }> = {
  pm: { label: "PM", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  admin: { label: "Admin", className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  accounting: { label: "Accounting", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  all: { label: "Everyone", className: "bg-muted text-muted-foreground border-border" },
};

const GUIDES: Guide[] = [
  {
    title: "Projects",
    icon: FolderKanban,
    items: [
      {
        title: "Create a new project",
        roles: ["pm", "admin"],
        relatedGuides: ["Use the project checklist", "Submit for billing"],
        steps: [
          "Go to Projects page",
          "Click '+ New Project'",
          { text: "Fill in property, client, and service details", tip: "If the property doesn't exist yet, you can create it inline from the property dropdown." },
          "Assign a PM and save",
          { text: "The project number is auto-generated in YYYY-NNNN format", tip: "Projects auto-advance phases as applications get approved and services are billed." },
        ],
      },
      {
        title: "Use the project checklist",
        roles: ["pm"],
        relatedGuides: ["Create a new project"],
        steps: [
          "Open a project detail page",
          "Switch to the Checklist tab",
          { text: "Check off items as they're completed", tip: "Overdue checklist items trigger automatic follow-up email drafts when enabled in Settings." },
          "Track overall readiness percentage",
        ],
      },
      {
        title: "Submit for billing",
        roles: ["pm"],
        relatedGuides: ["Create an invoice", "Track collections"],
        steps: [
          "Open a project",
          "Click 'Send to Billing'",
          { text: "Select services to bill", warning: "Only services marked as 'in_progress' or 'completed' can be submitted for billing." },
          "Add notes and submit",
          { text: "The billing team will be notified automatically based on their notification preferences", tip: "You can set a 'billed to' contact to route the invoice to a specific person." },
        ],
      },
      {
        title: "Manage action items",
        roles: ["pm", "admin"],
        relatedGuides: ["Use the project checklist"],
        steps: [
          "Open a project and go to the Action Items tab",
          { text: "Click '+ New Action Item' to create a task", tip: "You can extract action items from emails automatically using the 'Extract Tasks' feature." },
          "Assign to a team member and set a due date",
          "Track progress — assignees get notified automatically",
          { text: "Mark as done and add a completion note", tip: "Completed action items appear in the project timeline for an audit trail." },
        ],
      },
      {
        title: "Track change orders",
        roles: ["pm", "admin"],
        relatedGuides: ["Create an invoice", "Submit for billing"],
        steps: [
          "Open a project and go to the Change Orders tab",
          "Click '+ New Change Order'",
          { text: "Add line items with descriptions and amounts", tip: "Set a deposit percentage to auto-generate deposit tracking on approval." },
          "Sign internally, then send to the client for e-signature",
          { text: "Once fully signed, the CO auto-creates services on the project", tip: "The CO number (CO#1, CO#2, etc.) is generated automatically per project." },
        ],
      },
    ],
  },
  {
    title: "Proposals",
    icon: FileText,
    items: [
      {
        title: "Create and send a proposal",
        roles: ["pm", "admin"],
        relatedGuides: ["Track proposal follow-ups", "Capture and manage leads"],
        steps: [
          "Go to Proposals",
          "Click '+ New Proposal'",
          { text: "Add services from the catalog", tip: "Services pull from your company's service catalog — configure pricing and multipliers in Settings." },
          { text: "Add proposal contacts to CC on the sent email", tip: "Contacts are auto-suggested from the linked client's contact list." },
          "Preview the proposal and send to the client",
          { text: "Clients can view, sign, and submit the PIS from a single public link", tip: "Track when the client opens the proposal in real-time under the 'Viewed' indicator." },
        ],
      },
      {
        title: "Track proposal follow-ups",
        roles: ["pm"],
        relatedGuides: ["Create and send a proposal"],
        steps: [
          "Sent proposals automatically get a follow-up date (default: 7 days)",
          { text: "Follow-ups appear on your dashboard and in the proposals list", tip: "Customize the follow-up interval per proposal when creating it." },
          "Dismiss, snooze, or generate an AI follow-up email",
          { text: "The system tracks follow-up count to avoid over-contacting clients", warning: "Proposals marked as 'lost' or 'expired' clear all follow-up reminders." },
        ],
      },
      {
        title: "Capture and manage leads",
        roles: ["pm", "admin"],
        relatedGuides: ["Create and send a proposal"],
        steps: [
          "Go to Proposals and switch to the Leads tab",
          "Click '+ New Lead' to log an incoming inquiry",
          { text: "Assign a lead source for referral tracking", tip: "Customize lead sources in Settings > Lists & Lookups. This data feeds your Referral Reports." },
          "Convert qualified leads into proposals with one click",
        ],
      },
    ],
  },
  {
    title: "Billing & Invoices",
    icon: Receipt,
    items: [
      {
        title: "Create an invoice",
        roles: ["accounting", "admin"],
        relatedGuides: ["Track collections", "Set up billing schedules"],
        steps: [
          "Go to Billing page",
          "Click 'Create Invoice' or approve a billing request from PMs",
          { text: "Select project and services", tip: "The invoice amount auto-calculates from the selected services. You can also add custom line items." },
          "Set payment terms and send",
          { text: "Invoices are numbered automatically (INV-00001, etc.)", tip: "You can preview the PDF before sending and customize your company logo in Settings." },
        ],
      },
      {
        title: "Track collections",
        roles: ["accounting", "admin"],
        relatedGuides: ["Create an invoice", "Use AI for collections"],
        steps: [
          "Switch to the Collections tab",
          "View overdue invoices sorted by aging",
          { text: "Record payment promises with expected dates", tip: "Payment promises appear on the dashboard and calendar for follow-up." },
          { text: "Send collection reminders manually or use AI-generated messages", warning: "Always review AI-generated collection messages before sending — tone may need adjustment for sensitive client relationships." },
        ],
      },
      {
        title: "Set up billing schedules",
        roles: ["accounting", "admin"],
        relatedGuides: ["Create an invoice"],
        steps: [
          "Go to Billing > Schedules tab",
          "Click '+ New Schedule'",
          { text: "Choose frequency (weekly, biweekly, monthly, quarterly)", tip: "Enable 'auto-send' to have invoices generated and sent without manual approval." },
          "Link to a project and service",
          "The system auto-generates billing requests on schedule",
        ],
      },
      {
        title: "Use AI for collections",
        roles: ["accounting", "admin"],
        relatedGuides: ["Track collections"],
        steps: [
          "Open an overdue invoice",
          "Click 'Generate Collection Message'",
          { text: "AI analyzes the client's payment history and generates a personalized message", tip: "The AI considers payment risk score, previous promises, and relationship history." },
          "Review, edit if needed, and send",
        ],
      },
    ],
  },
  {
    title: "Time Tracking",
    icon: Clock,
    items: [
      {
        title: "Log time entries",
        roles: ["pm", "all"],
        relatedGuides: ["Clock in/out", "Submit for billing"],
        steps: [
          "Go to Time page",
          "Click '+ Log Time'",
          { text: "Select project and describe work", tip: "Mark entries as 'billable' to include them in billing calculations. Non-billable time is tracked separately for capacity planning." },
          "Mark as billable if applicable",
          { text: "Use the weekly timesheet view for bulk entry", tip: "The Quick Log widget on the dashboard lets you log time without leaving the main screen." },
        ],
      },
      {
        title: "Clock in/out",
        roles: ["all"],
        relatedGuides: ["Log time entries"],
        steps: [
          "Use the clock button in the top bar",
          { text: "Your session starts immediately", warning: "Sessions left open past midnight are auto-closed and flagged for review." },
          "Add notes when clocking out",
          "View attendance history in the Time page under Attendance tab",
        ],
      },
    ],
  },
  {
    title: "Email",
    icon: Mail,
    items: [
      {
        title: "Connect Gmail",
        roles: ["all"],
        relatedGuides: ["Tag and organize emails", "Use email reminders"],
        steps: [
          "Go to Email page",
          "Click 'Connect Gmail'",
          { text: "Authorize access through Google", warning: "Only your email is synced — Ordino never accesses other users' inboxes." },
          "Emails sync automatically going forward",
        ],
      },
      {
        title: "Tag and organize emails",
        roles: ["pm", "all"],
        relatedGuides: ["Connect Gmail", "Use email reminders"],
        steps: [
          "Open an email from the inbox",
          { text: "Use quick tags to categorize (e.g., Billing, Filing, Client)", tip: "Quick tags can be customized in Settings. Tags are searchable across all emails." },
          "Link emails to projects or clients for cross-referencing",
          "Add internal notes that only your team can see",
        ],
      },
      {
        title: "Use email reminders",
        roles: ["pm", "all"],
        relatedGuides: ["Tag and organize emails"],
        steps: [
          "Open any email and click the reminder icon",
          "Set a snooze time — the email reappears in your inbox later",
          { text: "Use this for follow-ups that don't need immediate action", tip: "Reminders appear as notifications, so you won't miss them even if you're on a different page." },
        ],
      },
    ],
  },
  {
    title: "RFPs",
    icon: ScrollText,
    items: [
      {
        title: "Track RFP opportunities",
        roles: ["pm", "admin"],
        relatedGuides: ["Build an RFP response", "Discover RFPs automatically"],
        steps: [
          "Go to RFPs page",
          "Add new RFP manually or from the Discovery feed",
          { text: "Move through pipeline stages using the Kanban board", tip: "Drag cards between columns to update status. Click a card to view full details." },
          "Build response documents from the content library",
        ],
      },
      {
        title: "Build an RFP response",
        roles: ["pm", "admin"],
        relatedGuides: ["Track RFP opportunities"],
        steps: [
          "Open an RFP and click 'Build Response'",
          "Select sections from your content library (bios, narratives, notable projects)",
          { text: "Reorder sections with drag-and-drop", tip: "AI can generate a cover letter tailored to the RFP requirements." },
          "Preview the compiled PDF and export",
        ],
      },
      {
        title: "Discover RFPs automatically",
        roles: ["admin"],
        relatedGuides: ["Track RFP opportunities"],
        steps: [
          "Go to RFPs > Discover tab",
          { text: "Configure monitoring for agencies you target", tip: "The system checks for new opportunities on a schedule and scores relevance against your company profile." },
          "Review recommended opportunities",
          "Promote to your pipeline with one click",
        ],
      },
    ],
  },
  {
    title: "Properties & Clients",
    icon: Building2,
    items: [
      {
        title: "Add a property",
        roles: ["pm", "admin"],
        relatedGuides: ["Manage client contacts", "Create a new project"],
        steps: [
          "Go to Properties page",
          "Click '+ New Property'",
          { text: "Enter address — autocomplete fills borough, block, and lot", tip: "NYC properties auto-lookup BIN and BBL from the city database." },
          "Link to projects as needed",
        ],
      },
      {
        title: "Manage client contacts",
        roles: ["pm", "admin", "accounting"],
        relatedGuides: ["Add a property", "Create an invoice"],
        steps: [
          "Go to Companies page",
          "Click into a client",
          { text: "Add contacts with roles (Owner, Architect, GC, etc.)", tip: "Mark a contact as 'primary billing' to auto-populate invoice recipients." },
          "Set primary billing contact",
          { text: "Use the merge feature to combine duplicate client records", warning: "Merging is irreversible — all projects, invoices, and contacts transfer to the primary record." },
        ],
      },
      {
        title: "Use Signal monitoring",
        roles: ["pm", "admin"],
        relatedGuides: ["Add a property"],
        steps: [
          "Open a property detail page",
          "Click 'Enroll in Signal' in the Signal section",
          { text: "Signal monitors DOB filings and violations for the property", tip: "You'll get notifications when new violations or applications are filed against enrolled properties." },
          "Review alerts in the property's Signal tab",
        ],
      },
    ],
  },
  {
    title: "Settings",
    icon: Settings,
    items: [
      {
        title: "Configure service catalog",
        roles: ["admin"],
        relatedGuides: ["How to set the Multiplier", "How to set Complexity Weight"],
        steps: [
          "Go to Settings > Proposals & Services",
          "Click '+ Add Service' to open the modal",
          "Fill in name, description, fee type, and price",
          { text: "Set multiplier and complexity weight (see related guides)", tip: "Services in the catalog are reusable across all proposals — changes here don't affect existing proposals." },
          "Save changes",
        ],
      },
      {
        title: "How to set the Multiplier",
        roles: ["admin"],
        relatedGuides: ["Configure service catalog"],
        steps: [
          { text: "The multiplier scales the base price when a service covers multiple units (floors, disciplines, etc.)", tip: "Example: A 'DOB Filing' costs $500 base. If the project has 3 disciplines and the multiplier is 1.5, the price adjusts to $500 × 1.5 × 3 = $2,250" },
          "Set to 0 or leave blank if the service is always a flat fee regardless of scope",
          "Common values: 1.0 (no scaling), 1.25–1.5 (moderate scaling per unit), 2.0+ (heavy per-unit scaling)",
        ],
      },
      {
        title: "How to set Complexity Weight",
        roles: ["admin"],
        relatedGuides: ["Configure service catalog"],
        steps: [
          "Complexity weight (1–10) tells the dashboard how much PM bandwidth a service consumes",
          { text: "1–2: Simple tasks like document pickups, basic filings", tip: "Low-weight services barely register on the PM capacity tracker." },
          "3–5: Standard services like DOB filings, plan reviews, or objection responses",
          "6–8: Complex services like full building alt-1 filings or multi-agency submissions",
          { text: "9–10: Major projects like full building new-build filings or litigation support", warning: "A single weight-10 service can consume a significant portion of a PM's reported capacity." },
          "The PM capacity tracker multiplies this weight by active project count to calculate workload",
        ],
      },
      {
        title: "Set up notification preferences",
        roles: ["all"],
        relatedGuides: [],
        steps: [
          "Go to Settings > Notifications",
          "Toggle categories on/off",
          { text: "Choose frequency (Realtime/Daily/Weekly)", tip: "Billing notifications have their own separate preferences under Settings > Billing Notifications." },
          "Save preferences",
        ],
      },
    ],
  },
];

// Build a flat lookup of all guide titles for related guide linking
const ALL_GUIDE_TITLES = GUIDES.flatMap((g) => g.items.map((i) => i.title));

export function HowToGuides() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const q = search.toLowerCase();

  const filtered = GUIDES.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      const matchesSearch =
        i.title.toLowerCase().includes(q) ||
        i.steps.some((s) => {
          const text = typeof s === "string" ? s : s.text;
          return text.toLowerCase().includes(q);
        });
      const matchesRole = roleFilter === "all" || i.roles.includes(roleFilter) || i.roles.includes("all");
      return matchesSearch && matchesRole;
    }),
  })).filter((g) => g.items.length > 0);

  const renderStep = (step: string | GuideStep, index: number) => {
    const text = typeof step === "string" ? step : step.text;
    const tip = typeof step === "string" ? undefined : step.tip;
    const warning = typeof step === "string" ? undefined : step.warning;

    return (
      <li key={index} className="space-y-1">
        <span>{text}</span>
        {tip && (
          <div className="flex items-start gap-1.5 ml-1 mt-1 p-2 rounded-md bg-amber-500/5 border border-amber-500/15 text-amber-700 dark:text-amber-400">
            <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="text-[11px] leading-relaxed">{tip}</span>
          </div>
        )}
        {warning && (
          <div className="flex items-start gap-1.5 ml-1 mt-1 p-2 rounded-md bg-red-500/5 border border-red-500/15 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="text-[11px] leading-relaxed">{warning}</span>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search guides..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {(["all", "pm", "admin", "accounting"] as const).map((role) => (
            <Button
              key={role}
              variant={roleFilter === role ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setRoleFilter(role)}
            >
              {ROLE_STYLES[role === "all" ? "all" : role].label}
            </Button>
          ))}
        </div>
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
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium hover:text-primary transition-colors py-1 text-left">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="truncate">{item.title}</span>
                        <div className="flex gap-1 shrink-0">
                          {item.roles.filter((r) => r !== "all").map((role) => (
                            <Badge key={role} variant="outline" className={`text-[9px] px-1 py-0 h-3.5 ${ROLE_STYLES[role].className}`}>
                              {ROLE_STYLES[role].label}
                            </Badge>
                          ))}
                          {item.roles.includes("all") && (
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 h-3.5 ${ROLE_STYLES.all.className}`}>
                              All
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1.5 pl-2 pt-1 pb-2">
                        {item.steps.map((step, i) => renderStep(step, i))}
                      </ol>
                      {item.relatedGuides && item.relatedGuides.length > 0 && (
                        <div className="border-t border-border/50 pt-2 pb-1 mt-1">
                          <p className="text-[10px] text-muted-foreground font-medium mb-1">Related guides</p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.relatedGuides.filter((rg) => ALL_GUIDE_TITLES.includes(rg)).map((rg) => (
                              <button
                                key={rg}
                                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                                onClick={() => setSearch(rg)}
                              >
                                <ArrowRight className="h-2.5 w-2.5" />
                                {rg}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
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
