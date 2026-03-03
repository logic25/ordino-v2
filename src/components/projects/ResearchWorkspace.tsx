import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search, Send, ChevronRight, ChevronDown, FileText, Sparkles,
  Save, Mail, CheckCircle2, Clock, AlertCircle, PanelLeftClose,
  PanelLeft, BookOpen, Upload, Bold, Italic, List,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ComposeEmailDialog } from "@/components/emails/ComposeEmailDialog";

// --- Types ---

type ObjectionStatus = "open" | "in_progress" | "resolved";

interface Objection {
  id: string;
  number: number;
  codeSection: string;
  examinerComment: string;
  status: ObjectionStatus;
}

interface BeaconResponse {
  id: string;
  query: string;
  sectionNumber: string;
  sectionTitle: string;
  sectionText: string;
  confidence: "High" | "Medium" | "Low";
  sources: string;
  pastReferences: { project: string; summary: string }[];
  bulletins: string[];
  timestamp: Date;
}

interface ObjectionWorkState {
  beaconResponses: BeaconResponse[];
  pmNotes: string;
  cleanedVersion: string | null;
}

// --- Mock Data ---

const MOCK_OBJECTIONS: Objection[] = [
  { id: "obj-1", number: 1, codeSection: "AC 28-104.7", examinerComment: "Provide a complete scope of work including all construction operations", status: "open" },
  { id: "obj-2", number: 2, codeSection: "AC 28-112.3", examinerComment: "Applicant of record does not match the BIS record for this filing", status: "open" },
  { id: "obj-3", number: 3, codeSection: "ZR 33-42", examinerComment: "Rear yard setback does not comply with the applicable zoning district requirements", status: "in_progress" },
  { id: "obj-4", number: 4, codeSection: "BC 1003.6", examinerComment: "Provide occupant load calculations for all floors affected by the proposed work", status: "open" },
  { id: "obj-5", number: 5, codeSection: "BC 3307.1", examinerComment: "Construction safeguards — provide details on temporary protection and safety measures", status: "open" },
  { id: "obj-6", number: 6, codeSection: "AC 28-105.4.1", examinerComment: "Energy code compliance path not indicated on the drawings", status: "resolved" },
  { id: "obj-7", number: 7, codeSection: "BC 1604.4", examinerComment: "Structural load path — provide documentation of the lateral force resisting system", status: "open" },
];

const MOCK_BEACON_RESPONSES: Record<string, Omit<BeaconResponse, "id" | "query" | "timestamp">> = {
  "ZR 33-42": {
    sectionNumber: "ZR 33-42",
    sectionTitle: "Rear Yard Regulations (C4-5X District)",
    sectionText: "In the districts indicated, for any building that exceeds a height of 60 feet or 6 stories, a rear yard with a minimum depth of 20 feet shall be provided at every level above the floor of the first story or above the floor of the story directly above a story used for non-residential purposes...",
    confidence: "High",
    sources: "NYC Zoning Resolution, Article III, Chapter 3",
    pastReferences: [
      { project: "45-10 Court Square (2024)", summary: "Same section cited. Team responded with rear yard equivalency analysis showing open area compliance through setback averaging. Resolved after one resubmission." },
    ],
    bulletins: ["TB 2019-003: Rear Yard Equivalency Calculation Guidelines"],
  },
  "AC 28-104.7": {
    sectionNumber: "AC 28-104.7",
    sectionTitle: "Scope of Work Requirements",
    sectionText: "Applications for construction document approval shall include a complete scope of work describing all construction operations to be performed under the permit, including but not limited to structural modifications, mechanical installations, plumbing, and electrical work...",
    confidence: "High",
    sources: "NYC Administrative Code, Title 28, Chapter 1",
    pastReferences: [
      { project: "123 Broadway (2023)", summary: "Examiner required itemized scope. We provided a detailed breakdown by trade. Cleared on first resubmission." },
    ],
    bulletins: [],
  },
  "AC 28-112.3": {
    sectionNumber: "AC 28-112.3",
    sectionTitle: "Professional Certification",
    sectionText: "The applicant of record who signs and seals the application must be the same professional engineer or registered architect whose information is on file with the Department for the associated BIS record...",
    confidence: "High",
    sources: "NYC Administrative Code, Title 28, Chapter 1",
    pastReferences: [],
    bulletins: ["DOB Bulletin 2021-007: Applicant of Record Verification"],
  },
  "BC 1003.6": {
    sectionNumber: "BC 1003.6",
    sectionTitle: "Occupant Load Calculations",
    sectionText: "The design occupant load for each floor or portion thereof shall be determined by dividing the floor area assigned to that use by the occupant load factor specified in Table 1004.5...",
    confidence: "Medium",
    sources: "NYC Building Code, Chapter 10 — Means of Egress",
    pastReferences: [
      { project: "7 East 14th Street (2024)", summary: "Examiner requested occupant load table for floors 2-5. Engineer prepared a spreadsheet with code reference annotations." },
    ],
    bulletins: [],
  },
};

function getDefaultBeaconResponse(codeSection: string): Omit<BeaconResponse, "id" | "query" | "timestamp"> {
  return {
    sectionNumber: codeSection,
    sectionTitle: "Code Section Details",
    sectionText: `Detailed text for ${codeSection} is being retrieved from the code database. This section typically addresses the specific requirements cited by the examiner. For full text, consult the relevant code volume directly.`,
    confidence: "Medium",
    sources: "NYC Building Code / Administrative Code / Zoning Resolution",
    pastReferences: [],
    bulletins: [],
  };
}

// --- Status helpers ---

const statusConfig: Record<ObjectionStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-muted text-muted-foreground border-border" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700" },
  resolved: { label: "Resolved", className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700" },
};

const confidenceColors: Record<string, string> = {
  High: "text-emerald-600 dark:text-emerald-400",
  Medium: "text-amber-600 dark:text-amber-400",
  Low: "text-red-600 dark:text-red-400",
};

// --- Sub-components ---

function ObjectionListItem({ objection, isSelected, onClick }: { objection: Objection; isSelected: boolean; onClick: () => void }) {
  const cfg = statusConfig[objection.status];
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-colors",
        isSelected ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20" : "bg-background border-border hover:bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">#{objection.number}</span>
            <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">{objection.codeSection}</Badge>
          </div>
          <p className="text-sm text-foreground line-clamp-2">{objection.examinerComment}</p>
        </div>
        <span className={cn("shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", cfg.className)}>
          {cfg.label}
        </span>
      </div>
    </button>
  );
}

function BeaconResponseCard({ response }: { response: BeaconResponse }) {
  const [expandRefs, setExpandRefs] = useState(false);
  const [expandBulletins, setExpandBulletins] = useState(false);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">{response.sectionNumber} — {response.sectionTitle}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-[10px] font-semibold", confidenceColors[response.confidence])}>
              {response.confidence} Confidence
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <p className="text-sm leading-relaxed text-foreground">{response.sectionText}</p>

        <div className="text-[11px] text-muted-foreground">
          Sources: {response.sources}
        </div>

        {response.pastReferences.length > 0 && (
          <Collapsible open={expandRefs} onOpenChange={setExpandRefs}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {expandRefs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Past Project References ({response.pastReferences.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {response.pastReferences.map((ref, i) => (
                <div key={i} className="p-2 rounded border bg-muted/30 text-sm">
                  <span className="font-medium">{ref.project}</span>
                  <p className="text-muted-foreground mt-0.5">{ref.summary}</p>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {response.bulletins.length > 0 && (
          <Collapsible open={expandBulletins} onOpenChange={setExpandBulletins}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {expandBulletins ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Related DOB Bulletins ({response.bulletins.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1">
              {response.bulletins.map((b, i) => (
                <div key={i} className="p-2 rounded border bg-muted/30 text-sm flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {b}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="text-[10px] text-muted-foreground">
          {response.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main Component ---

interface ResearchWorkspaceProps {
  projectId: string;
  projectAddress?: string;
  architectEmail?: string;
}

export function ResearchWorkspace({ projectId, projectAddress, architectEmail }: ResearchWorkspaceProps) {
  const { toast } = useToast();
  const [objections, setObjections] = useState<Objection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [workStates, setWorkStates] = useState<Record<string, ObjectionWorkState>>({});
  const [beaconInput, setBeaconInput] = useState("");
  const [beaconLoading, setBeaconLoading] = useState(false);
  const [cleanUpLoading, setCleanUpLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<{ to: string; subject: string; body: string }>({ to: "", subject: "", body: "" });
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selected = objections.find((o) => o.id === selectedId) || null;
  const openCount = objections.filter((o) => o.status === "open" || o.status === "in_progress").length;

  const getWorkState = useCallback((id: string): ObjectionWorkState => {
    return workStates[id] || { beaconResponses: [], pmNotes: "", cleanedVersion: null };
  }, [workStates]);

  const updateWorkState = useCallback((id: string, patch: Partial<ObjectionWorkState>) => {
    setWorkStates((prev) => ({
      ...prev,
      [id]: { ...prev[id] || { beaconResponses: [], pmNotes: "", cleanedVersion: null }, ...patch },
    }));
  }, []);

  const handleImport = () => {
    setObjections(MOCK_OBJECTIONS);
    setSelectedId(MOCK_OBJECTIONS[0].id);
    toast({ title: "Objection sheet imported", description: `${MOCK_OBJECTIONS.length} objections loaded.` });
  };

  const handleBeaconSend = () => {
    if (!beaconInput.trim() || !selected) return;
    setBeaconLoading(true);
    const query = beaconInput.trim();
    setBeaconInput("");

    setTimeout(() => {
      // Try to match a code section from the query
      const match = query.match(/[A-Z]{2}\s*\d[\d\-\.]+/i);
      const codeKey = match ? match[0].replace(/\s+/g, " ").toUpperCase() : selected.codeSection;
      const template = MOCK_BEACON_RESPONSES[codeKey] || getDefaultBeaconResponse(codeKey);

      const response: BeaconResponse = {
        ...template,
        id: `br-${Date.now()}`,
        query,
        timestamp: new Date(),
      };

      const current = getWorkState(selected.id);
      updateWorkState(selected.id, { beaconResponses: [...current.beaconResponses, response] });
      setBeaconLoading(false);
    }, 1000);
  };

  const handleCleanUp = () => {
    if (!selected) return;
    const ws = getWorkState(selected.id);
    if (!ws.pmNotes.trim()) {
      toast({ title: "No notes to clean up", description: "Write your notes first, then click Clean Up.", variant: "destructive" });
      return;
    }
    setCleanUpLoading(true);
    setTimeout(() => {
      const cleaned = `Based on the analysis of ${selected.codeSection}, ${ws.pmNotes.trim()}`;
      updateWorkState(selected.id, { cleanedVersion: cleaned });
      setCleanUpLoading(false);
      toast({ title: "Notes cleaned up by Beacon" });
    }, 1000);
  };

  const handleSaveToDocs = () => {
    toast({ title: "Research saved to Docs", description: `Notes for objection #${selected?.number} saved.` });
  };

  const handleSendAsEmail = () => {
    if (!selected) return;
    const ws = getWorkState(selected.id);
    const body = ws.cleanedVersion || ws.pmNotes || "";
    setComposeDefaults({
      to: architectEmail || "",
      subject: `RE: ${projectAddress || "Project"} — Response to DOB Objection #${selected.number}`,
      body,
    });
    setComposeOpen(true);
  };

  const handleStatusChange = (id: string, status: ObjectionStatus) => {
    setObjections((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    toast({ title: `Objection marked as ${statusConfig[status].label}` });
    // Auto-advance to next open objection
    if (status === "resolved") {
      const next = objections.find((o) => o.id !== id && o.status !== "resolved");
      if (next) setSelectedId(next.id);
    }
  };

  // Scroll to bottom of chat when new responses come in
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [workStates, selectedId]);

  const currentWorkState = selected ? getWorkState(selected.id) : null;

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px]">
      {/* Left Panel — Objection List */}
      {!panelCollapsed && (
        <div className="w-[38%] min-w-[280px] border-r flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Objections
              {openCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">{openCount}</Badge>
              )}
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleImport}>
                <Upload className="h-3 w-3" /> Import Sheet
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelCollapsed(true)}>
                <PanelLeftClose className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-2">
            {objections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No objections loaded</p>
                <p className="text-xs text-muted-foreground mt-1">Import a DOB objection sheet to get started</p>
                <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={handleImport}>
                  <Upload className="h-3.5 w-3.5" /> Import Mock Sheet
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {objections.map((obj) => (
                  <ObjectionListItem
                    key={obj.id}
                    objection={obj}
                    isSelected={selectedId === obj.id}
                    onClick={() => setSelectedId(obj.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Collapsed Toggle */}
      {panelCollapsed && (
        <div className="border-r flex flex-col items-center py-3 px-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelCollapsed(false)}>
            <PanelLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Right Panel — Research Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Select an objection to research</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Click on an objection from the list to open the research workspace. Use Beacon to look up code sections and build your response.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Objection Header */}
            <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-muted-foreground">#{selected.number}</span>
                <Badge variant="outline" className="font-mono text-xs">{selected.codeSection}</Badge>
                <Separator orientation="vertical" className="h-4" />
                <p className="text-sm truncate">{selected.examinerComment}</p>
              </div>
              <span className={cn("shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", statusConfig[selected.status].className)}>
                {statusConfig[selected.status].label}
              </span>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Section A: Beacon Research */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Beacon Research
                  </h4>

                  {/* Beacon Responses */}
                  {currentWorkState && currentWorkState.beaconResponses.length > 0 && (
                    <div className="space-y-3 mb-3">
                      {currentWorkState.beaconResponses.map((resp) => (
                        <div key={resp.id}>
                          <p className="text-xs text-muted-foreground mb-1.5 italic">"{resp.query}"</p>
                          <BeaconResponseCard response={resp} />
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  {/* Beacon Input */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9 pr-4"
                        placeholder={`Ask Beacon about ${selected.codeSection}...`}
                        value={beaconInput}
                        onChange={(e) => setBeaconInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleBeaconSend(); }}
                        disabled={beaconLoading}
                      />
                    </div>
                    <Button
                      size="icon"
                      className="shrink-0"
                      onClick={handleBeaconSend}
                      disabled={!beaconInput.trim() || beaconLoading}
                    >
                      {beaconLoading ? (
                        <Clock className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {currentWorkState && currentWorkState.beaconResponses.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      Try: "Pull up {selected.codeSection}" or "How did we handle this before?"
                    </p>
                  )}
                </div>

                <Separator />

                {/* Section B: PM Notes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Your Notes
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={handleCleanUp}
                      disabled={cleanUpLoading || !(currentWorkState?.pmNotes?.trim())}
                    >
                      {cleanUpLoading ? (
                        <Clock className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Clean Up with Beacon
                    </Button>
                  </div>

                  <Textarea
                    className="min-h-[120px] text-sm"
                    placeholder="Write your notes here — your interpretation of the code section, how it applies to this project, what you want to tell the architect..."
                    value={currentWorkState?.pmNotes || ""}
                    onChange={(e) => updateWorkState(selected.id, { pmNotes: e.target.value })}
                  />

                  {currentWorkState?.cleanedVersion && (
                    <Card className="mt-3 border-primary/20">
                      <CardHeader className="pb-1 pt-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <CardTitle className="text-xs font-semibold">Beacon's Version</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <Textarea
                          className="min-h-[80px] text-sm border-0 bg-transparent p-0 focus-visible:ring-0 resize-none"
                          value={currentWorkState.cleanedVersion}
                          onChange={(e) => updateWorkState(selected.id, { cleanedVersion: e.target.value })}
                        />
                        <div className="text-[10px] text-muted-foreground mt-1">
                          You can edit this version directly
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <Separator />

                {/* Section C: Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleSaveToDocs}>
                    <Save className="h-3.5 w-3.5" /> Save to Project Docs
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleSendAsEmail}>
                    <Mail className="h-3.5 w-3.5" /> Send as Email
                  </Button>
                  <div className="flex-1" />
                  {selected.status !== "in_progress" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 border-amber-400/50 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                      onClick={() => handleStatusChange(selected.id, "in_progress")}
                    >
                      <Clock className="h-3.5 w-3.5" /> Mark In Progress
                    </Button>
                  )}
                  {selected.status !== "resolved" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 border-emerald-400/50 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                      onClick={() => handleStatusChange(selected.id, "resolved")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Resolved
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Email Compose (lazy import of existing dialog) */}
      {composeOpen && (
        <ComposeEmailLazy
          open={composeOpen}
          onOpenChange={setComposeOpen}
          defaults={composeDefaults}
        />
      )}
    </div>
  );
}

function ComposeEmailLazy({ open, onOpenChange, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; defaults: { to: string; subject: string; body: string } }) {
  return (
    <ComposeEmailDialog
      open={open}
      onOpenChange={onOpenChange}
      defaultTo={defaults.to}
      defaultSubject={defaults.subject}
      defaultBody={defaults.body}
    />
  );
}

export function getOpenObjectionCount(): number {
  // For the tab badge - returns mock count. In a real implementation this would come from state/query.
  return MOCK_OBJECTIONS.filter((o) => o.status !== "resolved").length;
}
