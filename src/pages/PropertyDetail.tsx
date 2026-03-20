import { useParams, useNavigate } from "react-router-dom";
import { useState, useCallback, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, MapPin, Building2, Loader2, Pencil,
  FolderKanban, Radio, FileText, Briefcase, AlertTriangle,
  Shield, ExternalLink, User, Download, RefreshCw, ClipboardList,
} from "lucide-react";
import { useProperty } from "@/hooks/useProperties";
import { useApplicationsByProperty, APPLICATION_STATUSES } from "@/hooks/useApplications";
import { useSignalSubscription } from "@/hooks/useSignalSubscriptions";
import { useSignalViolations, summarizeViolations } from "@/hooks/useSignalViolations";
import { useSignalApplications } from "@/hooks/useSignalApplications";
import { SignalStatusBadge } from "@/components/properties/SignalStatusBadge";
import { SignalEnrollDialog } from "@/components/properties/SignalEnrollDialog";
import { PropertyDialog, PropertyFormData } from "@/components/properties/PropertyDialog";
import { useUpdateProperty } from "@/hooks/useProperties";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { COApplicationsView } from "@/components/properties/co/COApplicationsView";
import { COViolationsView } from "@/components/properties/co/COViolationsView";
import { COComplaintsView } from "@/components/properties/co/COComplaintsView";
import { COSummaryView } from "@/components/properties/co/COSummaryView";
import { COSetupWizard } from "@/components/properties/co/COSetupWizard";
import { useCoSignOffs } from "@/hooks/useCoSignOffs";
import {
  type COApplication, type COViolation,
} from "@/components/properties/co/coMockData";
import { fetchDOBApplications } from "@/hooks/useDOBApplications";
import { fetchDOBViolations, fetchDOBComplaints, type DOBComplaintRecord } from "@/hooks/useDOBViolations";
import { type RequiredItem } from "@/components/properties/co/requiredItemsData";
import { MessageSquareWarning } from "lucide-react";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // CO state
  const [coImported, setCoImported] = useState(false);
  const [coImporting, setCoImporting] = useState(false);
  const [coApps, setCoApps] = useState<COApplication[]>([]);
  const [coViolations, setCoViolations] = useState<COViolation[]>([]);
  const [coComplaints, setCoComplaints] = useState<DOBComplaintRecord[]>([]);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [coWorkTypeFilter, setCoWorkTypeFilter] = useState<string | null>(null);

  // Required items per application (keyed by jobNum) — user-added items only
  const [requiredItemsMap, setRequiredItemsMap] = useState<Record<string, RequiredItem[]>>({});

  const { data: property, isLoading } = useProperty(id);
  const { data: applications = [] } = useApplicationsByProperty(id);
  const { data: subscription } = useSignalSubscription(id);
  const { data: violations = [] } = useSignalViolations(id);
  const { data: signalApps = [] } = useSignalApplications(id);
  const { data: coSignOffs = [], isLoading: signOffsLoading } = useCoSignOffs(id);
  const updateProperty = useUpdateProperty();
  const summaries = summarizeViolations(violations);

  // Fetch projects for this property
  const { data: projects = [] } = useQuery({
    queryKey: ["property-projects", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          assigned_pm:profiles!projects_assigned_pm_id_fkey (id, first_name, last_name),
          clients!projects_client_id_fkey (id, name)
        `)
        .eq("property_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // CitiSignal enrollment checks
  const isSubscriptionActive = subscription?.status === "active" || subscription?.status === "trial";
  const isSubscriptionInactive = subscription?.status === "prospect" || subscription?.status === "expired";

  // Auto-fetch DOB data when CitiSignal is active and property has BIN
  const autoFetchedRef = useRef(false);
  useEffect(() => {
    if (autoFetchedRef.current) return;
    if (!property?.bin) return;
    if (!isSubscriptionActive) return;
    if (coImported || coImporting) return;
    autoFetchedRef.current = true;
    // Trigger the import
    (async () => {
      setCoImporting(true);
      try {
        const [apps, viols, complaints] = await Promise.all([
          fetchDOBApplications(property.bin!),
          fetchDOBViolations(property.bin!),
          fetchDOBComplaints(property.bin!),
        ]);
        setCoApps(apps);
        setCoViolations(viols);
        setCoComplaints(complaints);
        setCoImported(true);
        setLastSynced(format(new Date(), "MM/dd/yyyy h:mm a"));

        // Persist DOB data to signal tables
        if (profile?.company_id && id) {
          try {
            if (apps.length > 0) {
              const appRows = apps.map((a: any) => ({
                property_id: id,
                company_id: profile.company_id,
                job_number: a.jobNum || a.job_number || "",
                application_type: a.workType || a.application_type || "Unknown",
                filing_status: a.status || null,
                applicant_name: a.applicant || null,
                filed_date: a.filedDate || null,
                description: a.description || null,
                raw_data: a,
              }));
              await supabase.from("signal_applications").upsert(appRows as any, { onConflict: "property_id,job_number" });
            }
            if (viols.length > 0) {
              const violRows = viols.map((v: any) => ({
                property_id: id,
                company_id: profile.company_id,
                violation_number: v.violationNum || v.violation_number || "",
                agency: v.agency || "DOB",
                status: v.status || "open",
                description: v.description || null,
                penalty_amount: v.penaltyAmount || v.penalty_amount || 0,
                issued_date: v.issuedDate || null,
                raw_data: v,
              }));
              await supabase.from("signal_violations").upsert(violRows as any, { onConflict: "property_id,violation_number" });
            }
          } catch (persistErr) {
            console.error("Error persisting DOB data:", persistErr);
          }
        }

        if (apps.length === 0) {
          toast({
            title: "No DOB applications found",
            description: `No filings found for BIN ${property.bin}. This property may not have any DOB filings.`,
          });
        }
      } catch {
        // Silent fail on auto-fetch; user can manually retry
      } finally {
        setCoImporting(false);
      }
    })();
  }, [property?.bin, isSubscriptionActive, coImported, coImporting, toast, profile?.company_id, id]);

  // Import DOB data (real NYC Open Data)
  const handleImportDOBData = useCallback(async () => {
    if (!isSubscriptionActive && !isSubscriptionInactive) {
      setEnrollOpen(true);
      toast({
        title: "CitiSignal enrollment required",
        description: "Enroll this property in CitiSignal to access CO tracking tools.",
        variant: "destructive",
      });
      return;
    }
    if (!property?.bin) {
      toast({
        title: "BIN required",
        description: "This property doesn't have a BIN number. Edit the property to add one before importing DOB data.",
        variant: "destructive",
      });
      return;
    }
    setCoImporting(true);
    try {
      const [apps, viols, complaints] = await Promise.all([
        fetchDOBApplications(property.bin),
        fetchDOBViolations(property.bin),
        fetchDOBComplaints(property.bin),
      ]);
      setCoApps(apps);
      setCoViolations(viols);
      setCoComplaints(complaints);
      setCoImported(true);
      setLastSynced(format(new Date(), "MM/dd/yyyy h:mm a"));

      // Persist DOB data to signal tables
      if (profile?.company_id && id) {
        try {
          if (apps.length > 0) {
            const appRows = apps.map((a: any) => ({
              property_id: id,
              company_id: profile.company_id,
              job_number: a.jobNum || a.job_number || "",
              application_type: a.workType || a.application_type || "Unknown",
              filing_status: a.status || null,
              applicant_name: a.applicant || null,
              filed_date: a.filedDate || null,
              description: a.description || null,
              raw_data: a,
            }));
            await supabase.from("signal_applications").upsert(appRows as any, { onConflict: "property_id,job_number" });
          }
          if (viols.length > 0) {
            const violRows = viols.map((v: any) => ({
              property_id: id,
              company_id: profile.company_id,
              violation_number: v.violationNum || v.violation_number || "",
              agency: v.agency || "DOB",
              status: v.status || "open",
              description: v.description || null,
              penalty_amount: v.penaltyAmount || v.penalty_amount || 0,
              issued_date: v.issuedDate || null,
              raw_data: v,
            }));
            await supabase.from("signal_violations").upsert(violRows as any, { onConflict: "property_id,violation_number" });
          }
        } catch (persistErr) {
          console.error("Error persisting DOB data:", persistErr);
        }
      }

      if (apps.length === 0) {
        toast({
          title: "No DOB applications found",
          description: `No filings found for BIN ${property.bin}. This property may not have any DOB filings.`,
        });
      } else {
        toast({
          title: "DOB Data Imported",
          description: `Imported ${apps.length} applications for BIN ${property.bin}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Failed to fetch DOB data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCoImporting(false);
    }
  }, [property, toast, isSubscriptionActive, isSubscriptionInactive]);

  const handleUpdateApp = useCallback((jobNum: string, updates: Partial<COApplication>) => {
    setCoApps(prev => prev.map(a => a.jobNum === jobNum ? { ...a, ...updates } : a));
    toast({ title: "Application updated" });
  }, [toast]);

  const handleUpdateViolation = useCallback((violationNum: string, updates: Partial<COViolation>) => {
    setCoViolations(prev => prev.map(v => v.violationNum === violationNum ? { ...v, ...updates } : v));
    toast({ title: "Violation updated" });
  }, [toast]);

  const handleFilterWorkType = useCallback((wt: string) => {
    setCoWorkTypeFilter(wt);
    setActiveTab("co_applications");
  }, []);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!property) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <h2 className="text-xl font-semibold">Property not found</h2>
          <Button variant="outline" onClick={() => navigate("/properties")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Properties
          </Button>
        </div>
      </AppLayout>
    );
  }

  const formatBorough = (borough: string | null) => {
    if (!borough) return null;
    return borough.replace("_", " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatStatus = (status: string | null) => {
    if (!status) return "Draft";
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const statusColor = (status: string | null) => {
    const colors: Record<string, string> = {
      open: "bg-green-500/10 text-green-700",
      on_hold: "bg-amber-500/10 text-amber-700",
      closed: "bg-muted text-muted-foreground",
      paid: "bg-blue-500/10 text-blue-700",
    };
    return colors[status || ""] || "bg-muted text-muted-foreground";
  };

  const appStatusColor = (status: string | null) => {
    const found = APPLICATION_STATUSES.find(s => s.value === status);
    return found?.color || "bg-muted text-muted-foreground";
  };

  const handleEditSubmit = async (data: PropertyFormData) => {
    try {
      await updateProperty.mutateAsync({ id: property.id, ...data });
      toast({ title: "Property updated", description: "Changes saved." });
      setEditOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const totalViolations = violations.length;
  const openViolations = violations.filter(v => v.status === "open").length;
  const totalPenalties = violations.reduce((s, v) => s + (v.penalty_amount || 0), 0);

  const openCoApps = coApps.filter(a => a.status !== "Signed Off").length;
  const activeCoViols = coViolations.filter(v => v.status === "Active" || v.status === "In Resolution").length;
  const activeComplaints = coComplaints.filter(c => c.status.toUpperCase() !== "CLOSE" && c.status.toUpperCase() !== "CLOSED").length;

  // CitiSignal enrollment gate component
  const CitiSignalGate = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
      <div className="rounded-full bg-blue-500/10 p-4">
        <Radio className="h-8 w-8 text-blue-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">CitiSignal Monitoring Required</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          CitiSignal monitoring is required for CO work. Enroll this property to access CO tracking tools, 
          violation monitoring, and application management.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          CitiSignal monitoring is included as part of your CO project fee.
        </p>
      </div>
      <Button onClick={() => setEnrollOpen(true)} className="gap-1.5">
        <Radio className="h-4 w-4" /> Enroll in CitiSignal
      </Button>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" className="mt-1 shrink-0" onClick={() => navigate("/properties")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{property.address}</h1>
                {property.borough && (
                  <Badge variant="secondary">{formatBorough(property.borough)}</Badge>
                )}
                <button type="button" onClick={() => setEnrollOpen(true)} className="cursor-pointer hover:opacity-80 transition-opacity">
                  <SignalStatusBadge status={subscription?.status || null} />
                </button>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                {(property.block || property.lot) && (
                  <span>
                    {property.block && `Block ${property.block}`}
                    {property.block && property.lot && " / "}
                    {property.lot && `Lot ${property.lot}`}
                  </span>
                )}
                {property.bin && <span>BIN: {property.bin}</span>}
                {property.zip_code && <span>ZIP: {property.zip_code}</span>}
                {property.owner_name && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> {property.owner_name}
                  </span>
                )}
              </div>
              {property.aka_addresses && (property.aka_addresses as string[]).length > 0 && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">AKA:</span>
                  {(property.aka_addresses as string[]).map((aka, i) => (
                    <Badge key={i} variant="outline" className="text-xs font-normal">
                      {aka}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!coImported && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleImportDOBData} disabled={coImporting}>
                {coImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {coImporting ? "Importing..." : "Import DOB Data"}
              </Button>
            )}
            {coImported && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleImportDOBData} disabled={coImporting}>
                {coImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Projects</div>
              <div className="text-2xl font-bold mt-1">{projects.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">DOB Applications</div>
              <div className="text-2xl font-bold mt-1">{coImported ? coApps.length : applications.length}</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setEnrollOpen(true)}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">CitiSignal Status</div>
              <div className="mt-1">
                <SignalStatusBadge status={subscription?.status || null} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Open Violations</div>
              <div className={`text-2xl font-bold mt-1 ${(coImported ? activeCoViols : openViolations) > 0 ? "text-red-600" : ""}`}>
                {coImported ? activeCoViols : openViolations}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total Penalties</div>
              <div className="text-2xl font-bold mt-1">
                {totalPenalties > 0 ? `$${totalPenalties.toLocaleString()}` : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CO Import Banner */}
        {coImported && lastSynced && (
          <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-2.5 text-sm">
            <Radio className="h-4 w-4 text-blue-600 shrink-0" />
            <span>CitiSignal · NYC Open Data imported · Last synced: {lastSynced}</span>
            <div className="flex gap-1.5 ml-auto">
              <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">DOB Job Filings</Badge>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20 text-[10px]">DOB NOW Build</Badge>
              <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/20 text-[10px]">DOB Violations</Badge>
            </div>
          </div>
        )}

        {/* Inactive subscription warning */}
        {isSubscriptionInactive && coImported && (
          <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-2.5 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
            <span>CitiSignal subscription is inactive. Activate to enable real-time monitoring.</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEnrollOpen(true)}>
              Activate
            </Button>
          </div>
        )}

        {/* Tabbed Content */}
        <Card>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start rounded-none rounded-t-lg border-b bg-muted/20 h-11 px-4 gap-1 flex-wrap">
              <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:bg-background">
                <Building2 className="h-3.5 w-3.5" /> Overview
              </TabsTrigger>
              <TabsTrigger value="co_summary" className="gap-1.5 data-[state=active]:bg-background">
                <ClipboardList className="h-3.5 w-3.5" /> CO Summary
              </TabsTrigger>
              <TabsTrigger value="co_applications" className="gap-1.5 data-[state=active]:bg-background">
                <FolderKanban className="h-3.5 w-3.5" /> Applications
                {coImported && openCoApps > 0 && (
                  <Badge variant="outline" className="ml-1 bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs h-5 px-1.5">
                    {openCoApps}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="co_violations" className="gap-1.5 data-[state=active]:bg-background">
                <AlertTriangle className="h-3.5 w-3.5" /> Violations
                {coImported && activeCoViols > 0 && (
                  <Badge variant="outline" className="ml-1 bg-red-500/10 text-red-600 border-red-500/20 text-xs h-5 px-1.5">
                    {activeCoViols}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="co_complaints" className="gap-1.5 data-[state=active]:bg-background">
                <MessageSquareWarning className="h-3.5 w-3.5" /> Complaints
                {coImported && activeComplaints > 0 && (
                  <Badge variant="outline" className="ml-1 bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs h-5 px-1.5">
                    {activeComplaints}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-1.5 data-[state=active]:bg-background">
                <Briefcase className="h-3.5 w-3.5" /> Projects ({projects.length})
              </TabsTrigger>
              {!coImported && (
                <TabsTrigger value="applications" className="gap-1.5 data-[state=active]:bg-background">
                  <FolderKanban className="h-3.5 w-3.5" /> Applications ({applications.length})
                </TabsTrigger>
              )}
            </TabsList>

            <CardContent className="p-0">
              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-0 p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Property Details</h3>
                    <div className="grid gap-3">
                      {[
                        { label: "Address", value: property.address },
                        { label: "Borough", value: formatBorough(property.borough) },
                        { label: "Block", value: property.block },
                        { label: "Lot", value: property.lot },
                        { label: "BIN", value: property.bin },
                        { label: "ZIP Code", value: property.zip_code },
                        { label: "Owner", value: property.owner_name },
                        { label: "Owner Contact", value: property.owner_contact },
                      ].map((item) => (
                        <div key={item.label} className="flex justify-between border-b border-border/50 pb-2">
                          <span className="text-sm text-muted-foreground">{item.label}</span>
                          <span className="text-sm font-medium">{item.value || "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Notes</h3>
                    <div className="rounded-md border p-4 min-h-[120px] text-sm">
                      {property.notes || <span className="text-muted-foreground italic">No notes</span>}
                    </div>

                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mt-6">Quick Stats</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">Active Projects</span>
                        <span className="text-sm font-medium">{projects.filter(p => p.status === "open").length}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">Open Applications</span>
                        <span className="text-sm font-medium">
                          {coImported ? openCoApps : applications.filter(a => !["complete", "closed"].includes(a.status || "")).length}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">External Applications (CitiSignal)</span>
                        <span className="text-sm font-medium">{signalApps.length}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">Total Violations</span>
                        <span className="text-sm font-medium">{coImported ? coViolations.length : totalViolations}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* CitiSignal info merged into Overview — tab removed */}

              {/* CO Summary Tab */}
              <TabsContent value="co_summary" className="mt-0 p-6">
                {!isSubscriptionActive && !isSubscriptionInactive ? (
                  <CitiSignalGate />
                ) : !coImported ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <Download className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Import DOB data to view the CO Summary dashboard.</p>
                    <Button variant="outline" onClick={handleImportDOBData} disabled={coImporting}>
                      {coImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                      Import DOB Data
                    </Button>
                  </div>
                ) : !signOffsLoading && coSignOffs.length === 0 ? (
                  <COSetupWizard
                    propertyId={property.id}
                    propertyAddress={property.address}
                    onComplete={() => {}}
                  />
                ) : (
                  <COSummaryView
                    applications={coApps}
                    violations={coViolations}
                    propertyAddress={property.address}
                    block={property.block}
                    lot={property.lot}
                    onFilterWorkType={handleFilterWorkType}
                    lastSynced={lastSynced}
                    requiredItemsMap={requiredItemsMap}
                    projectId={projects[0]?.id || null}
                    companyId={profile?.company_id || null}
                    profileId={profile?.id || null}
                    propertyId={property.id}
                    dbSignOffs={coSignOffs.length > 0 ? coSignOffs : undefined}
                  />
                )}
              </TabsContent>

              {/* CO Applications Tab */}
              <TabsContent value="co_applications" className="mt-0 p-6">
                {!isSubscriptionActive && !isSubscriptionInactive ? (
                  <CitiSignalGate />
                ) : !coImported ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <Download className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Import DOB data to view applications.</p>
                    <Button variant="outline" onClick={handleImportDOBData} disabled={coImporting}>
                      {coImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                      Import DOB Data
                    </Button>
                  </div>
                ) : (
                  <COApplicationsView
                    applications={coApps}
                    onUpdateApp={handleUpdateApp}
                    initialWorkTypeFilter={coWorkTypeFilter}
                  />
                )}
              </TabsContent>

              {/* CO Violations Tab */}
              <TabsContent value="co_violations" className="mt-0 p-6">
                {!isSubscriptionActive && !isSubscriptionInactive ? (
                  <CitiSignalGate />
                ) : !coImported ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <Download className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Import DOB data to view violations.</p>
                    <Button variant="outline" onClick={handleImportDOBData} disabled={coImporting}>
                      {coImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                      Import DOB Data
                    </Button>
                  </div>
                ) : (
                  <COViolationsView
                    violations={coViolations}
                    onUpdateViolation={handleUpdateViolation}
                  />
                )}
              </TabsContent>

              {/* CO Complaints Tab */}
              <TabsContent value="co_complaints" className="mt-0 p-6">
                {!isSubscriptionActive && !isSubscriptionInactive ? (
                  <CitiSignalGate />
                ) : !coImported ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <Download className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Import DOB data to view complaints.</p>
                    <Button variant="outline" onClick={handleImportDOBData} disabled={coImporting}>
                      {coImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                      Import DOB Data
                    </Button>
                  </div>
                ) : (
                  <COComplaintsView complaints={coComplaints} />
                )}
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value="projects" className="mt-0 p-6">
                {projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Briefcase className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No projects for this property yet</p>
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Project #</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>PM</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projects.map((proj: any) => (
                          <TableRow
                            key={proj.id}
                            className="cursor-pointer hover:bg-accent/5"
                            onClick={() => navigate(`/projects/${proj.id}`)}
                          >
                            <TableCell className="font-mono text-sm">{proj.project_number || "—"}</TableCell>
                            <TableCell className="font-medium text-sm">{proj.name || "—"}</TableCell>
                            <TableCell className="text-sm">{proj.project_type || "—"}</TableCell>
                            <TableCell className="text-sm">{proj.clients?.name || "—"}</TableCell>
                            <TableCell className="text-sm">
                              {proj.assigned_pm
                                ? [proj.assigned_pm.first_name, proj.assigned_pm.last_name].filter(Boolean).join(" ")
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColor(proj.status)}>
                                {formatStatus(proj.status)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* Original Applications Tab (shown when CO not imported) */}
              {!coImported && (
                <TabsContent value="applications" className="mt-0 p-6">
                  {applications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FolderKanban className="h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">No DOB applications for this property</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Type</TableHead>
                            <TableHead>Job #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Filed</TableHead>
                            <TableHead>PM</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {applications.map((app) => (
                            <TableRow key={app.id}>
                              <TableCell className="font-medium text-sm">{app.application_type || "DOB"}</TableCell>
                              <TableCell className="font-mono text-sm">{app.job_number || "—"}</TableCell>
                              <TableCell className="text-sm max-w-xs truncate">{app.description || "—"}</TableCell>
                              <TableCell className="text-sm">
                                {app.filed_date ? format(new Date(app.filed_date), "MM/dd/yyyy") : "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {app.profiles
                                  ? [app.profiles.first_name, app.profiles.last_name].filter(Boolean).join(" ")
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge className={appStatusColor(app.status)}>
                                  {formatStatus(app.status)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              )}
            </CardContent>
          </Tabs>
        </Card>
      </div>

      <PropertyDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEditSubmit}
        property={property}
        isLoading={updateProperty.isPending}
      />

      <SignalEnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        propertyId={property.id}
        propertyAddress={property.address}
        existing={subscription}
      />
    </AppLayout>
  );
}
