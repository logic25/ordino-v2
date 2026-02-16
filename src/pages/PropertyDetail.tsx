import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
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
  Shield, ExternalLink, User,
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
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const { data: property, isLoading } = useProperty(id);
  const { data: applications = [] } = useApplicationsByProperty(id);
  const { data: subscription } = useSignalSubscription(id);
  const { data: violations = [] } = useSignalViolations(id);
  const { data: signalApps = [] } = useSignalApplications(id);
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
                <SignalStatusBadge status={subscription?.status || null} />
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
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
              <div className="text-2xl font-bold mt-1">{applications.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Signal Status</div>
              <div className="mt-1">
                <SignalStatusBadge status={subscription?.status || null} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Open Violations</div>
              <div className={`text-2xl font-bold mt-1 ${openViolations > 0 ? "text-red-600" : ""}`}>
                {openViolations}
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

        {/* Tabbed Content */}
        <Card>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start rounded-none rounded-t-lg border-b bg-muted/20 h-11 px-4 gap-1">
              <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:bg-background">
                <Building2 className="h-3.5 w-3.5" /> Overview
              </TabsTrigger>
              <TabsTrigger value="signal" className="gap-1.5 data-[state=active]:bg-background">
                <Radio className="h-3.5 w-3.5" /> Signal
                {openViolations > 0 && (
                  <Badge variant="outline" className="ml-1 bg-red-500/10 text-red-600 border-red-500/20 text-xs h-5 px-1.5">
                    {openViolations}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-1.5 data-[state=active]:bg-background">
                <Briefcase className="h-3.5 w-3.5" /> Projects ({projects.length})
              </TabsTrigger>
              <TabsTrigger value="applications" className="gap-1.5 data-[state=active]:bg-background">
                <FolderKanban className="h-3.5 w-3.5" /> Applications ({applications.length})
              </TabsTrigger>
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
                          {applications.filter(a => !["complete", "closed"].includes(a.status || "")).length}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">External Applications (Signal)</span>
                        <span className="text-sm font-medium">{signalApps.length}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">Total Violations</span>
                        <span className="text-sm font-medium">{totalViolations}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Signal Tab */}
              <TabsContent value="signal" className="mt-0 p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Signal Monitoring</h3>
                    <p className="text-sm text-muted-foreground">
                      Violations, external applications, and monitoring status
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEnrollOpen(true)}>
                    {subscription ? "Manage Subscription" : "Enroll in Signal"}
                  </Button>
                </div>

                {!subscription && (
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-4 flex items-start gap-3">
                    <Shield className="h-5 w-5 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Not Monitored</p>
                      <p>Enroll this property in Signal to automatically track DOB violations and external applications.</p>
                    </div>
                  </div>
                )}

                {/* Violations */}
                {summaries.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Violations by Agency
                    </h4>
                    <div className="grid gap-2">
                      {summaries.map((s) => (
                        <div key={s.agency} className="flex items-center justify-between bg-muted/30 rounded-md border px-4 py-3">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{s.agency}</p>
                              <p className="text-xs text-muted-foreground">
                                {s.open} open · {s.resolved} resolved
                                {s.totalPenalty > 0 && ` · $${s.totalPenalty.toLocaleString()} penalties`}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className={s.open > 0 ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600"}>
                            {s.total} total
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Violation Details Table */}
                {violations.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      All Violations ({violations.length})
                    </h4>
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Agency</TableHead>
                            <TableHead>Violation #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Issued</TableHead>
                            <TableHead>Penalty</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {violations.map((v) => (
                            <TableRow key={v.id}>
                              <TableCell className="font-medium text-sm">{v.agency}</TableCell>
                              <TableCell className="text-sm font-mono">{v.violation_number}</TableCell>
                              <TableCell className="text-sm max-w-xs truncate">{v.description}</TableCell>
                              <TableCell className="text-sm">{v.issued_date ? format(new Date(v.issued_date), "MM/dd/yyyy") : "—"}</TableCell>
                              <TableCell className="text-sm">{v.penalty_amount ? `$${v.penalty_amount.toLocaleString()}` : "—"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={v.status === "open" ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600"}>
                                  {v.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* External Applications */}
                {signalApps.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      External Applications ({signalApps.length})
                    </h4>
                    <div className="grid gap-2">
                      {signalApps.map((app) => (
                        <div key={app.id} className="flex items-center justify-between bg-muted/30 rounded-md border px-4 py-3">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">
                                {app.application_type}
                                {app.job_number && <span className="text-muted-foreground font-normal ml-2">#{app.job_number}</span>}
                              </p>
                              {app.applicant_name && (
                                <p className="text-xs text-muted-foreground">Filed by: {app.applicant_name}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                            <Radio className="h-3 w-3" /> Signal
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!subscription && violations.length === 0 && signalApps.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Radio className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No Signal data yet. Enroll to start monitoring.</p>
                  </div>
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

              {/* Applications Tab */}
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
