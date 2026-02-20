import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ExternalLink, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChangelogEntry {
  date: string;
  title: string;
  description: string;
  tag: "feature" | "improvement" | "fix";
  videoUrl?: string;
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

function getMonthLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function groupByMonth(entries: ChangelogEntry[]) {
  const groups: Record<string, ChangelogEntry[]> = {};
  for (const entry of entries) {
    const label = getMonthLabel(entry.date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }
  return Object.entries(groups);
}

function EntryRow({ entry }: { entry: ChangelogEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 w-20 shrink-0">
          {entry.date}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-medium text-sm">{entry.title}</p>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${TAG_STYLES[entry.tag]}`}>
              {entry.tag}
            </Badge>
            {entry.videoUrl && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-rose-500/10 text-rose-600 border-rose-300 gap-1">
                <Video className="h-2.5 w-2.5" /> Loom
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{entry.description}</p>
        </div>
        <div className="shrink-0 mt-0.5 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
          {entry.videoUrl ? (
            <a
              href={entry.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Video className="h-4 w-4" />
              Watch walkthrough video
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No walkthrough video recorded yet — check back soon.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function WhatsNew() {
  const groups = groupByMonth(CHANGELOG);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(
    new Set(groups.slice(1).map(([label]) => label)) // collapse all but the latest month
  );

  const toggleMonth = (label: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {groups.map(([month, entries]) => {
        const isCollapsed = collapsedMonths.has(month);
        return (
          <div key={month} className="space-y-2">
            <button
              className="flex items-center gap-2 w-full group"
              onClick={() => toggleMonth(month)}
            >
              {isCollapsed
                ? <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              }
              <h3 className="text-sm font-semibold text-foreground">{month}</h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{entries.length}</Badge>
            </button>

            {!isCollapsed && (
              <div className="space-y-1.5 ml-6">
                {entries.map((entry, i) => (
                  <EntryRow key={i} entry={entry} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
