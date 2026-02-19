import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { AlertTriangle, Clock, Lightbulb, Rocket, CheckCircle2 } from "lucide-react";

type RoadmapStatus = "gap" | "planned" | "in_progress" | "done";
type RoadmapCategory = "billing" | "projects" | "integrations" | "security" | "documents" | "operations";

interface RoadmapItem {
  title: string;
  description: string;
  category: RoadmapCategory;
  status: RoadmapStatus;
  priority: "high" | "medium" | "low";
}

const ROADMAP_ITEMS: RoadmapItem[] = [
  // Known gaps
  {
    title: "Mid-Project Change Orders",
    description: "Allow modifying project scope and services after the project has started. Currently, once a proposal converts to a project, the service list is fixed. This should support adding/removing services, adjusting fees, and tracking the change order history with timestamps and approval records.",
    category: "projects",
    status: "gap",
    priority: "high",
  },
  {
    title: "Per-Service Billing Party Transitions",
    description: "Support splitting one project's billing among multiple clients. For example, a project may start billing Client A, then transition specific services to Client B mid-stream. Requires tracking which services are billed to which contact/client at any given time.",
    category: "billing",
    status: "gap",
    priority: "high",
  },
  {
    title: "DOB Filing Fee Pass-Through Tracking",
    description: "Track DOB filing fees that are paid on behalf of clients and need to be passed through on invoices. Currently there's no structured way to log these fees, tie them to specific applications, and ensure they're included in the next billing cycle.",
    category: "billing",
    status: "gap",
    priority: "medium",
  },
  {
    title: "Subcontractor / Vendor Management",
    description: "Track third-party deliverables and invoices from subcontractors (e.g., expeditors, special inspectors). Include vendor contact info, scope assignments, deliverable tracking, and cost reconciliation against project budgets.",
    category: "operations",
    status: "gap",
    priority: "medium",
  },
  // Planned
  {
    title: "File Migration to Cloud Storage",
    description: "Migrate legacy project files to cloud storage with automatic versioning, folder structures per project, and searchable metadata. Replace current ad-hoc file references with a structured document management system.",
    category: "documents",
    status: "planned",
    priority: "high",
  },
  {
    title: "PDF Annotation Tools",
    description: "Enable in-app annotation of uploaded PDFs — markup, comments, stamps, and redlining. Critical for plan review workflows where PMs need to highlight issues on architectural drawings without leaving the platform.",
    category: "documents",
    status: "planned",
    priority: "medium",
  },
  {
    title: "AI-Powered Project Discovery from Plans",
    description: "Automatically analyze uploaded architectural plans to extract project scope, identify required services (e.g., Alt-2, CO, Pull Permit), and pre-populate proposal line items. Reduces manual data entry when onboarding new projects.",
    category: "projects",
    status: "planned",
    priority: "medium",
  },
  {
    title: "Google Chat Integration",
    description: "Send automated notifications and alerts to Google Chat spaces — new proposals, overdue invoices, project status changes. Allows team communication without switching to email for routine updates.",
    category: "integrations",
    status: "planned",
    priority: "low",
  },
  {
    title: "Browser Extension for DOB Form-Filling",
    description: "A companion browser extension that reads project data from Ordino and auto-fills DOB NOW forms, reducing manual data entry and transcription errors during the filing process.",
    category: "integrations",
    status: "planned",
    priority: "medium",
  },
  {
    title: "Password Guardian Credential Vault",
    description: "Secure, encrypted storage for shared credentials (DOB accounts, client portals, vendor logins). Role-based access ensures only authorized team members can view or use stored credentials, with full audit logging.",
    category: "security",
    status: "planned",
    priority: "low",
  },
  {
    title: "Project Phase Tracking",
    description: "Track project lifecycle phases (Pre-filing → Filing → Approval → Closeout) with visual status indicators. Each phase has configurable milestones, and the system surfaces which phase each project is in across all views.",
    category: "projects",
    status: "in_progress",
    priority: "high",
  },
];

const STATUS_CONFIG: Record<RoadmapStatus, { label: string; style: string; icon: React.ElementType }> = {
  gap: { label: "Known Gap", style: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
  planned: { label: "Planned", style: "bg-blue-500/10 text-blue-700 border-blue-300", icon: Lightbulb },
  in_progress: { label: "In Progress", style: "bg-amber-500/10 text-amber-700 border-amber-300", icon: Clock },
  done: { label: "Done", style: "bg-green-500/10 text-green-700 border-green-300", icon: CheckCircle2 },
};

const CATEGORY_LABELS: Record<RoadmapCategory, string> = {
  billing: "Billing",
  projects: "Projects",
  integrations: "Integrations",
  security: "Security",
  documents: "Documents",
  operations: "Operations",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-amber-500/10 text-amber-700",
  low: "bg-muted text-muted-foreground",
};

export function ProductRoadmap() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filtered = ROADMAP_ITEMS.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterCategory !== "all" && item.category !== filterCategory) return false;
    return true;
  });

  const statusOrder: RoadmapStatus[] = ["gap", "in_progress", "planned", "done"];
  const sorted = [...filtered].sort((a, b) => {
    const si = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    if (si !== 0) return si;
    const pi = ["high", "medium", "low"].indexOf(a.priority) - ["high", "medium", "low"].indexOf(b.priority);
    return pi;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Rocket className="h-5 w-5 text-primary" />
        <p className="text-sm text-muted-foreground flex-1">
          Internal product roadmap — tracks known gaps, planned features, and what's in progress.
        </p>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="gap">Known Gaps</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {sorted.map((item, i) => {
          const statusConf = STATUS_CONFIG[item.status];
          const StatusIcon = statusConf.icon;
          return (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <StatusIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-sm text-foreground">{item.title}</p>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusConf.style}`}>
                        {statusConf.label}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {CATEGORY_LABELS[item.category]}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_STYLES[item.priority]}`}>
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            No items match the selected filters.
          </CardContent>
        </Card>
      )}
    </div>
  );
}