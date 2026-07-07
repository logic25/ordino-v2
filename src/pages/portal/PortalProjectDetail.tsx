import { useParams, Link } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { StagePill } from "@/components/portal/StagePill";
import { DisciplineTimeline } from "@/components/portal/DisciplineTimeline";
import {
  usePortalProject, useFilings, useFilingEvents, useClientActionItems, usePortalDocuments,
} from "@/hooks/usePortal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, FileText, ClipboardList, Activity as ActivityIcon, AlertCircle, Download } from "lucide-react";
import { safeFormatDate } from "@/lib/dateUtils";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading } = usePortalProject(id);
  const { data: filings = [] } = useFilings(id);
  const { data: events = [] } = useFilingEvents(id);
  const { data: actionItems = [] } = useClientActionItems(id);
  const { data: docs = [] } = usePortalDocuments(id);

  const clientOpenItems = actionItems.filter((a) => a.owner === "client" && a.status === "open");
  const blockedFilings = filings.filter((f) => f.blocked);

  if (isLoading) {
    return <PortalLayout><Skeleton className="h-40" /></PortalLayout>;
  }
  if (!project) {
    return (
      <PortalLayout>
        <p className="text-muted-foreground">Project not found or you don't have access.</p>
      </PortalLayout>
    );
  }

  const prop: any = (project as any).properties;

  return (
    <PortalLayout>
      <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Portfolio
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
            {prop?.address && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{prop.address}{prop.borough ? `, ${prop.borough}` : ""}</span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {project.project_number && (
                <span className="text-muted-foreground">Project # <span className="font-mono text-foreground">{project.project_number}</span></span>
              )}
              {prop?.bin && <span className="text-muted-foreground">BIN <span className="font-mono text-foreground">{prop.bin}</span></span>}
              {project.filing_type && <span className="text-muted-foreground">{project.filing_type}</span>}
            </div>
          </div>
          <StagePill stage={project.portal_overall_stage} />
        </div>
      </div>

      {/* Action-needed banner */}
      {(clientOpenItems.length > 0 || blockedFilings.length > 0) && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <div className="font-medium">
              {clientOpenItems.length + blockedFilings.length} item{(clientOpenItems.length + blockedFilings.length) === 1 ? "" : "s"} need{(clientOpenItems.length + blockedFilings.length) === 1 ? "s" : ""} your attention
            </div>
            <div className="mt-0.5 text-amber-800">
              {blockedFilings.length > 0 && <>{blockedFilings.length} blocked filing{blockedFilings.length === 1 ? "" : "s"}. </>}
              {clientOpenItems.length > 0 && <>{clientOpenItems.length} open action item{clientOpenItems.length === 1 ? "" : "s"} owned by you.</>}
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="timeline">
        <TabsList className="bg-white border">
          <TabsTrigger value="timeline"><ActivityIcon className="h-3.5 w-3.5 mr-1.5" />Timeline</TabsTrigger>
          <TabsTrigger value="actions"><ClipboardList className="h-3.5 w-3.5 mr-1.5" />Action Items{clientOpenItems.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] px-1.5">{clientOpenItems.length}</span>}</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="h-3.5 w-3.5 mr-1.5" />Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* TIMELINE — per discipline */}
        <TabsContent value="timeline" className="mt-4 space-y-3">
          {filings.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-lg bg-white p-6 text-center">
              No filings on this project yet.
            </div>
          ) : (
            <>
              {blockedFilings.map((f) => <DisciplineTimeline key={f.id} filing={f} />)}
              {filings.filter((f) => !f.blocked).map((f) => <DisciplineTimeline key={f.id} filing={f} />)}
            </>
          )}
        </TabsContent>

        {/* ACTION ITEMS */}
        <TabsContent value="actions" className="mt-4 space-y-6">
          {(["client", "gle", "agency"] as const).map((owner) => {
            const items = actionItems.filter((a) => a.owner === owner);
            if (items.length === 0) return null;
            const label = owner === "client" ? "You" : owner === "gle" ? "GLE" : "Agency";
            return (
              <section key={owner}>
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Owner: {label}</h3>
                <div className="rounded-lg border bg-white divide-y">
                  {items.map((a) => (
                    <div key={a.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900">{a.title}</div>
                        {a.description && <div className="text-xs text-muted-foreground mt-1">{a.description}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">{a.due_date ? `Due ${safeFormatDate(a.due_date, "MMM d")}` : "No due date"}</div>
                        <div className={`text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded-full ring-1 ring-inset ${a.status === "done" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-700 ring-slate-200"}`}>
                          {a.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          {actionItems.length === 0 && (
            <div className="text-sm text-muted-foreground border rounded-lg bg-white p-6 text-center">
              No action items.
            </div>
          )}
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="mt-4 space-y-6">
          {docs.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-lg bg-white p-6 text-center">
              No documents uploaded yet.
            </div>
          ) : (
            Object.entries(groupBy(docs, "doc_type")).map(([type, items]) => (
              <section key={type}>
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{type}</h3>
                <div className="rounded-lg border bg-white divide-y">
                  {items.map((d) => (
                    <div key={d.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm truncate">{d.display_name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Uploaded {safeFormatDate(d.uploaded_at, "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                      <button className="text-xs text-sky-700 hover:underline inline-flex items-center gap-1" disabled>
                        <Download className="h-3 w-3" /> Download
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </TabsContent>

        {/* ACTIVITY */}
        <TabsContent value="activity" className="mt-4">
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-lg bg-white p-6 text-center">
              No activity yet.
            </div>
          ) : (
            <div className="rounded-lg border bg-white divide-y">
              {events.map((e) => (
                <div key={e.id} className="p-3 text-sm">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{safeFormatDate(e.occurred_at, "MMM d, HH:mm")}</span>
                    {e.stage && <StagePill stage={e.stage} />}
                    <span className="ml-auto text-[10px] uppercase tracking-wide">{e.source}</span>
                  </div>
                  {e.note && <div className="mt-1 text-slate-800">{e.note}</div>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PortalLayout>
  );
}

function groupBy<T extends Record<string, any>>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    (acc[k] ??= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
