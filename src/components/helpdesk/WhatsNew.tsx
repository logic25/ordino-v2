import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ChangelogEntry {
  date: string;
  title: string;
  description: string;
  tag: "feature" | "improvement" | "fix";
}

const CHANGELOG: ChangelogEntry[] = [
  { date: "2026-02-20", title: "AI Roadmap Stress Test", description: "Run AI analysis on any roadmap item directly from the edit dialog. Results (evidence, priority rationale, implementation risks) are saved to the card and shown with a purple AI badge.", tag: "feature" },
  { date: "2026-02-20", title: "Interactive Training for AI Features", description: "New guided walkthroughs for AI Stress Test, AI Collections & Payment Risk, and AI Plan & Proposal Analysis added to the Help Center training tab.", tag: "feature" },
  { date: "2026-02-20", title: "Product Roadmap (Admin)", description: "Admin-only Kanban/table roadmap with AI Intake, behavior analysis, and drag-and-drop reordering. Feature requests can be promoted into roadmap items.", tag: "feature" },
  { date: "2026-02-18", title: "PM Billing Capacity Tracker", description: "Complexity-weighted workload tracking for PMs with smart billing targets based on service mix and checklist readiness.", tag: "feature" },
  { date: "2026-02-18", title: "Notification Preferences", description: "Configure notification frequency (realtime, daily, weekly) for billing, projects, proposals, and email alerts in Settings.", tag: "feature" },
  { date: "2026-02-17", title: "Year-over-Year Revenue Chart", description: "Compare monthly revenue across years on the admin dashboard.", tag: "feature" },
  { date: "2026-02-17", title: "Proposal Activity Card", description: "Month-over-month proposal volume and value change indicators.", tag: "feature" },
  { date: "2026-02-17", title: "Referral Reports", description: "Track top referrers, conversion rates, and referral source breakdown.", tag: "feature" },
  { date: "2026-02-17", title: "Data Exports", description: "CSV export for projects, clients, invoices, proposals, time entries, and contacts.", tag: "feature" },
  { date: "2026-02-16", title: "Enhanced Admin Dashboard", description: "Full-width revenue trend chart with period selector and restructured layout.", tag: "improvement" },
  { date: "2026-02-15", title: "Email Integration Improvements", description: "Keyboard shortcuts, snooze, scheduled send, and attachment previews.", tag: "improvement" },
  { date: "2026-02-14", title: "RFP Discovery & Monitoring", description: "Automated RFP discovery with relevance scoring and partner outreach.", tag: "feature" },
];

const TAG_STYLES: Record<string, string> = {
  feature: "bg-primary/10 text-primary border-primary/30",
  improvement: "bg-blue-500/10 text-blue-700 border-blue-300",
  fix: "bg-amber-500/10 text-amber-700 border-amber-300",
};

export function WhatsNew() {
  return (
    <div className="space-y-3">
      {CHANGELOG.map((entry, i) => (
        <Card key={i}>
          <CardContent className="flex items-start gap-4 p-4">
            <div className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 w-20 shrink-0">
              {entry.date}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-sm">{entry.title}</p>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${TAG_STYLES[entry.tag]}`}>
                  {entry.tag}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{entry.description}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
