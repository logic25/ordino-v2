import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, flexRender,
  type ColumnDef, type SortingState, type VisibilityState, type RowSelectionState,
} from "@tanstack/react-table";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  UserPlus, Flame, ArrowUpDown, SlidersHorizontal, Columns3, Download, Trash2,
  ChevronDown, Plus, Star, Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useLeads, useUpdateLead, useBulkUpdateLeads, useDeleteLead,
  type Lead, type LeadStage, type LeadSourceType,
} from "@/hooks/useLeads";
import {
  useLeadViews, useSeedDefaultViews, useCreateLeadView, useDeleteLeadView,
  type LeadView, type LeadViewFilters,
} from "@/hooks/useLeadViews";
import {
  STAGE_META, STAGE_ORDER, ALL_STAGES, SOURCE_META, TIMELINE_LABELS, profileLabel, initials, daysSince,
} from "@/components/bd/leadConstants";
import { CaptureLeadModal } from "@/components/bd/CaptureLeadModal";

const HIDDEN_BY_DEFAULT: VisibilityState = {
  contact_email: false, contact_phone: false, property_address: false, subject: false,
  referred_by: false, event: false, architect_name: false, gc_name: false,
  sia_name: false, tpp_name: false,
};

const COLUMN_LABELS: Record<string, string> = {
  full_name: "Name", company: "Company", stage: "Stage", source_type: "Source",
  assigned_to: "Owner", days: "Days since created", hot_opportunity: "Hot",
  expected_value: "Expected value", project_timeline: "Timeline",
  contact_email: "Email", contact_phone: "Phone", property_address: "Property address",
  subject: "Subject", referred_by: "Referred by", event: "Event name",
  architect_name: "Architect / Engineer", gc_name: "General Contractor",
  sia_name: "Special Inspector", tpp_name: "TPP Applicant",
};

function applyFilters(leads: Lead[], f: LeadViewFilters & { source?: string }, search: string): Lead[] {
  const q = search.trim().toLowerCase();
  return leads.filter((l) => {
    if (f.stage?.length && (!l.stage || !f.stage.includes(l.stage))) return false;
    if (f.stage_not?.length && l.stage && f.stage_not.includes(l.stage)) return false;
    if (f.source_type?.length && (!l.source_type || !f.source_type.includes(l.source_type))) return false;
    if (f.source && (l as any).source !== f.source) return false;
    if (f.assigned_to?.length && (!l.assigned_to || !f.assigned_to.includes(l.assigned_to))) return false;
    if (f.hot_opportunity && !l.hot_opportunity) return false;
    if (f.event_id && l.event_id !== f.event_id) return false;
    if (f.created_after && new Date(l.created_at) < new Date(f.created_after)) return false;
    if (f.created_before && new Date(l.created_at) > new Date(f.created_before)) return false;
    if (f.value_min != null && (l.expected_value ?? 0) < f.value_min) return false;
    if (f.value_max != null && (l.expected_value ?? Infinity) > f.value_max) return false;
    if (f.stale && !(l.stage === "NEW" && daysSince(l.created_at) > 7)) return false;
    if (q) {
      const hay = [l.full_name, l.company, l.contact_email, l.property_address, l.subject]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function BdLeads() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: leads = [], isLoading } = useLeads();
  const { data: profiles = [] } = useAssignableProfiles();
  const { isAdmin } = usePermissions();
  const updateLead = useUpdateLead();
  const bulkUpdate = useBulkUpdateLeads();
  const deleteLead = useDeleteLead();

  const { data: views = [] } = useLeadViews();
  const seedViews = useSeedDefaultViews();
  const createView = useCreateLeadView();
  const deleteView = useDeleteLeadView();

  const [captureOpen, setCaptureOpen] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [filters, setFilters] = useState<LeadViewFilters>({});
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "days", desc: false }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(HIDDEN_BY_DEFAULT);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Seed default views on first visit.
  useEffect(() => {
    if (!seedViews.isPending && views.length === 0 && !seedViews.isSuccess) {
      seedViews.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views.length]);

  function applyView(v: LeadView) {
    setActiveViewId(v.id);
    setFilters(v.filters_json ?? {});
    if (v.sort_json?.id) setSorting([{ id: v.sort_json.id, desc: !!v.sort_json.desc }]);
    setColumnVisibility({ ...HIDDEN_BY_DEFAULT, ...(v.columns_json ?? {}) });
  }

  // Default to the is_default view once views load.
  useEffect(() => {
    if (!activeViewId && views.length) {
      const def = views.find((v) => v.is_default) ?? views[0];
      applyView(def);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views.length]);

  // URL params override active view filters (deep-link from reports, etc.).
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const event_id = searchParams.get("event") || undefined;
    const source = searchParams.get("source") || undefined;
    const stage = searchParams.get("stage") || undefined;
    const source_type = searchParams.get("source_type") || undefined;
    if (event_id || source || stage || source_type) {
      setActiveViewId(null);
      setFilters((f) => ({
        ...f,
        ...(event_id ? { event_id } : {}),
        ...(source ? { source } as any : {}),
        ...(stage ? { stage: [stage] } : {}),
        ...(source_type ? { source_type: [source_type] } : {}),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const profileById = useMemo(
    () => Object.fromEntries(profiles.map((p: any) => [p.id, p])),
    [profiles],
  );

  const filtered = useMemo(() => applyFilters(leads, filters, search), [leads, filters, search]);

  const columns = useMemo<ColumnDef<Lead>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "full_name", accessorKey: "full_name", header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.full_name}</span>,
    },
    { id: "company", accessorKey: "company", header: "Company", cell: ({ getValue }) => (getValue() as string) || "—" },
    {
      id: "stage", accessorKey: "stage", header: "Stage",
      cell: ({ row }) => {
        const lead = row.original;
        const meta = lead.stage ? STAGE_META[lead.stage] : null;
        return (
          <Select
            value={lead.stage ?? undefined}
            onValueChange={(v) => updateLead.mutate({ id: lead.id, stage: v as LeadStage })}
          >
            <SelectTrigger className="h-7 w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0" onClick={(e) => e.stopPropagation()}>
              <Badge variant="outline" className={meta?.className}>{meta?.label ?? "—"}</Badge>
            </SelectTrigger>
            <SelectContent>
              {STAGE_ORDER.map((s) => <SelectItem key={s} value={s}>{STAGE_META[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: "source_type", accessorKey: "source_type", header: "Source",
      cell: ({ row }) => {
        const st = row.original.source_type;
        if (!st) return "—";
        const m = SOURCE_META[st as LeadSourceType];
        const Icon = m.icon;
        return <span className="flex items-center gap-1.5 text-sm"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{m.label}</span>;
      },
    },
    {
      id: "assigned_to", accessorKey: "assigned_to", header: "Owner",
      cell: ({ row }) => {
        const lead = row.original;
        const p = lead.assigned_to ? profileById[lead.assigned_to] : null;
        const label = profileLabel(p);
        return (
          <Select
            value={lead.assigned_to ?? undefined}
            onValueChange={(v) => updateLead.mutate({ id: lead.id, assigned_to: v })}
          >
            <SelectTrigger className="h-7 w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{initials(label)}</AvatarFallback></Avatar>
              <span className="text-sm">{label}</span>
            </SelectTrigger>
            <SelectContent>
              {profiles.map((pp: any) => (
                <SelectItem key={pp.id} value={pp.id}>{profileLabel(pp)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: "days", accessorFn: (l) => daysSince(l.created_at), header: "Days",
      cell: ({ getValue }) => `${getValue()}d`,
    },
    {
      id: "hot_opportunity", accessorKey: "hot_opportunity", header: "Hot",
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); updateLead.mutate({ id: lead.id, hot_opportunity: !lead.hot_opportunity }); }}
            aria-label="Toggle hot"
          >
            <Flame className={`h-4 w-4 ${lead.hot_opportunity ? "text-orange-500 fill-orange-500" : "text-muted-foreground/40"}`} />
          </button>
        );
      },
    },
    {
      id: "expected_value", accessorKey: "expected_value", header: "Value",
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v != null ? `$${v.toLocaleString()}` : "—";
      },
    },
    {
      id: "project_timeline", accessorKey: "project_timeline", header: "Timeline",
      cell: ({ getValue }) => {
        const v = getValue() as keyof typeof TIMELINE_LABELS | null;
        return v ? TIMELINE_LABELS[v] : "—";
      },
    },
    // Hidden-by-default
    { id: "contact_email", accessorKey: "contact_email", header: "Email", cell: ({ getValue }) => (getValue() as string) || "—" },
    { id: "contact_phone", accessorKey: "contact_phone", header: "Phone", cell: ({ getValue }) => (getValue() as string) || "—" },
    { id: "property_address", accessorKey: "property_address", header: "Property", cell: ({ getValue }) => (getValue() as string) || "—" },
    { id: "subject", accessorKey: "subject", header: "Subject", cell: ({ getValue }) => (getValue() as string) || "—" },
    { id: "referred_by", accessorKey: "referred_by", header: "Referred by", cell: ({ getValue }) => (getValue() as string) || "—" },
    { id: "event", accessorFn: (l) => l.event?.name ?? "", header: "Event", cell: ({ getValue }) => (getValue() as string) || "—" },
    { id: "architect_name", accessorKey: "architect_name", header: "Architect", cell: ({ getValue }) => (getValue() as string) || "—" },
    { id: "gc_name", accessorKey: "gc_name", header: "GC", cell: ({ getValue }) => (getValue() as string) || "—" },
    { id: "sia_name", accessorKey: "sia_name", header: "SIA", cell: ({ getValue }) => (getValue() as string) || "—" },
    { id: "tpp_name", accessorKey: "tpp_name", header: "TPP", cell: ({ getValue }) => (getValue() as string) || "—" },
  ], [profileById, profiles, updateLead]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  const handleExport = () => {
    const rows = selectedIds.length ? filtered.filter((l) => selectedIds.includes(l.id)) : filtered;
    const cols = ["full_name", "company", "stage", "source_type", "contact_email", "contact_phone", "expected_value", "created_at"];
    const header = cols.join(",");
    const body = rows.map((l) => cols.map((c) => csvEscape((l as any)[c])).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkDelete = async () => {
    if (!isAdmin) return;
    await deleteLead.mutateAsync(selectedIds);
    setRowSelection({});
    toast({ title: `Deleted ${selectedIds.length} lead(s)` });
  };

  const handleSaveView = async () => {
    const name = window.prompt("Name this view:");
    if (!name) return;
    const id = await createView.mutateAsync({
      name,
      filters_json: filters,
      columns_json: columnVisibility as Record<string, boolean>,
      sort_json: sorting[0] ?? { id: "created_at", desc: true },
    });
    setActiveViewId(id);
    toast({ title: "View saved", description: name });
  };

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
            <p className="text-muted-foreground mt-1">Track every potential new client end-to-end.</p>
          </div>
          <Button onClick={() => setCaptureOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Lead</Button>
        </div>

        {/* Saved views */}
        <div className="flex items-center gap-2 flex-wrap">
          {views.map((v) => (
            <div key={v.id} className="flex items-center">
              <Button
                size="sm"
                variant={activeViewId === v.id ? "default" : "outline"}
                className="rounded-r-none"
                onClick={() => applyView(v)}
              >
                {v.is_default && <Star className="mr-1.5 h-3 w-3" />}{v.name}
              </Button>
              {!v.is_default && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant={activeViewId === v.id ? "default" : "outline"} className="rounded-l-none border-l-0 px-1.5">
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-destructive" onClick={() => deleteView.mutate(v.id)}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" />Delete view
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={handleSaveView}><Plus className="mr-1 h-3.5 w-3.5" />Save view</Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Input placeholder="Search leads…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-9" />
          <FilterPopover filters={filters} setFilters={setFilters} profiles={profiles} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><Columns3 className="mr-2 h-4 w-4" />Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllLeafColumns().filter((c) => c.id !== "select" && c.getCanHide()).map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={c.getIsVisible()}
                  onCheckedChange={(v) => c.toggleVisibility(!!v)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {COLUMN_LABELS[c.id] ?? c.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="ml-auto text-sm text-muted-foreground">{filtered.length} lead{filtered.length === 1 ? "" : "s"}</div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 flex-wrap">
            <span className="text-sm font-medium">{selectedIds.length} selected</span>
            <Select onValueChange={(v) => bulkUpdate.mutate({ ids: selectedIds, updates: { assigned_to: v } })}>
              <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Change owner" /></SelectTrigger>
              <SelectContent>{profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>)}</SelectContent>
            </Select>
            <Select onValueChange={(v) => bulkUpdate.mutate({ ids: selectedIds, updates: { stage: v } })}>
              <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Change stage" /></SelectTrigger>
              <SelectContent>{STAGE_ORDER.map((s) => <SelectItem key={s} value={s}>{STAGE_META[s].label}</SelectItem>)}</SelectContent>
            </Select>
            <BulkEnrollSequence ids={selectedIds} />
            <Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button>
            {isAdmin && (
              <Button size="sm" variant="outline" className="text-destructive" onClick={handleBulkDelete}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete
              </Button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        </button>
                      ) : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">No leads. Capture one to get started.</TableCell></TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => navigate(`/bd/leads/${row.original.id}`)}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CaptureLeadModal
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        onCreated={(id) => navigate(`/bd/leads/${id}`)}
      />
    </AppLayout>
  );
}

function FilterPopover({
  filters, setFilters, profiles,
}: {
  filters: LeadViewFilters;
  setFilters: (f: LeadViewFilters) => void;
  profiles: any[];
}) {
  const toggle = (key: "stage" | "source_type" | "assigned_to", val: string) => {
    const cur = new Set(filters[key] ?? []);
    cur.has(val) ? cur.delete(val) : cur.add(val);
    setFilters({ ...filters, [key]: Array.from(cur) });
  };
  const activeCount =
    (filters.stage?.length ? 1 : 0) + (filters.source_type?.length ? 1 : 0) +
    (filters.assigned_to?.length ? 1 : 0) + (filters.hot_opportunity ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="mr-2 h-4 w-4" />Filters
          {activeCount > 0 && <Badge variant="secondary" className="ml-2 px-1.5">{activeCount}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 max-h-[70vh] overflow-y-auto">
        <div>
          <p className="text-xs font-semibold mb-1.5">Stage</p>
          <div className="flex flex-wrap gap-1.5">
            {STAGE_ORDER.map((s) => (
              <Badge key={s} variant={filters.stage?.includes(s) ? "default" : "outline"}
                className="cursor-pointer text-xs" onClick={() => toggle("stage", s)}>{STAGE_META[s].label}</Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold mb-1.5">Source</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(SOURCE_META).map(([k, m]) => (
              <Badge key={k} variant={filters.source_type?.includes(k) ? "default" : "outline"}
                className="cursor-pointer text-xs" onClick={() => toggle("source_type", k)}>{m.label}</Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold mb-1.5">Owner</p>
          <div className="flex flex-wrap gap-1.5">
            {profiles.map((p) => (
              <Badge key={p.id} variant={filters.assigned_to?.includes(p.id) ? "default" : "outline"}
                className="cursor-pointer text-xs" onClick={() => toggle("assigned_to", p.id)}>{profileLabel(p)}</Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="f-hot" checked={!!filters.hot_opportunity}
            onCheckedChange={(c) => setFilters({ ...filters, hot_opportunity: !!c || undefined })} />
          <label htmlFor="f-hot" className="text-sm">🔥 Hot opportunities only</label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs font-semibold mb-1">Value min</p>
            <Input type="number" className="h-8" value={filters.value_min ?? ""}
              onChange={(e) => setFilters({ ...filters, value_min: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1">Value max</p>
            <Input type="number" className="h-8" value={filters.value_max ?? ""}
              onChange={(e) => setFilters({ ...filters, value_max: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1">Created after</p>
            <Input type="date" className="h-8" value={filters.created_after ?? ""}
              onChange={(e) => setFilters({ ...filters, created_after: e.target.value || undefined })} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1">Created before</p>
            <Input type="date" className="h-8" value={filters.created_before ?? ""}
              onChange={(e) => setFilters({ ...filters, created_before: e.target.value || undefined })} />
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilters({})}>Clear filters</Button>
      </PopoverContent>
    </Popover>
  );
}

// ====== Bulk enroll selected leads in a sequence ======
import { useSequences, useEnrollLead } from "@/hooks/useBdSequences";

function BulkEnrollSequence({ ids }: { ids: string[] }) {
  const sequences = useSequences();
  const enroll = useEnrollLead();
  const { toast } = useToast();
  return (
    <Select onValueChange={(sequence_id) => {
      enroll.mutate({ sequence_id, lead_ids: ids }, {
        onSuccess: () => toast({ title: `Enrolled ${ids.length} lead${ids.length === 1 ? "" : "s"}` }),
      });
    }}>
      <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Enroll in sequence" /></SelectTrigger>
      <SelectContent>
        {(sequences.data ?? []).length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No sequences. Create one in BD → Sequences.</div>}
        {(sequences.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
