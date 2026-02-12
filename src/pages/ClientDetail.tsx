import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  FileText,
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Linkedin,
  Star,
  ShieldCheck,
  Mail,
  ChevronDown,
  Phone,
  MoreHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useClientContacts,
  useDeleteClient,
  useUpdateClient,
  type Client,
  type ClientContact,
  type ClientFormInput,
} from "@/hooks/useClients";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { AddContactDialog } from "@/components/clients/AddContactDialog";
import { ReviewsSection } from "@/components/clients/ReviewsSection";
import { ClientProposalsModal } from "@/components/clients/ClientProposalsModal";
import { useCompanyProfiles, type Profile } from "@/hooks/useProfiles";

function useClientDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["client-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
    enabled: !!id,
  });
}

function useClientStats(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-stats", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const [projectsRes, proposalsRes] = await Promise.all([
        supabase.from("projects").select("id, status").eq("client_id", clientId),
        supabase.from("proposals").select("id, status, total_amount").eq("client_id", clientId),
      ]);
      const projects = projectsRes.data || [];
      const proposals = proposalsRes.data || [];
      const totalProposals = proposals.length;
      const proposalsSent = proposals.filter((p) => p.status !== "draft").length;
      const proposalsConverted = proposals.filter(
        (p) => p.status === "accepted" || p.status === "signed_client"
      ).length;
      const conversionRate =
        proposalsSent > 0 ? Math.round((proposalsConverted / proposalsSent) * 100) : 0;
      const totalValue = proposals
        .filter((p) => p.status === "accepted" || p.status === "signed_client")
        .reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const activeProjects = projects.filter((p) => p.status === "open").length;
      const totalProjects = projects.length;
      return { totalProposals, proposalsSent, proposalsConverted, conversionRate, totalValue, activeProjects, totalProjects };
    },
    enabled: !!clientId,
  });
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);

function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value;
}

function getProfileName(profiles: Profile[], id: string | null) {
  if (!id) return null;
  const p = profiles.find((pr) => pr.id === id);
  return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : null;
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: client, isLoading } = useClientDetail(id);
  const { data: contacts = [], isLoading: contactsLoading } = useClientContacts(id);
  const { data: stats } = useClientStats(id);
  const { data: profiles = [] } = useCompanyProfiles();
  const deleteClient = useDeleteClient();
  const updateClient = useUpdateClient();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [proposalsOpen, setProposalsOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  const toggleSelect = (contactId: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteClient.mutateAsync(id);
      toast({ title: "Client deleted" });
      navigate("/clients");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteContact = async () => {
    if (!deleteContactId) return;
    try {
      const { error } = await supabase.from("client_contacts").delete().eq("id", deleteContactId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["client-contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["client-detail", id] });
      toast({ title: "Contact deleted" });
      setDeleteContactId(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return;
    try {
      const { error } = await supabase
        .from("client_contacts")
        .delete()
        .in("id", [...selectedContacts]);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["client-contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["client-detail", id] });
      toast({ title: `${selectedContacts.size} contact(s) deleted` });
      setSelectedContacts(new Set());
      setBulkDeleteOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdate = async (data: ClientFormInput) => {
    if (!id) return;
    try {
      await updateClient.mutateAsync({ id, ...data });
      toast({ title: "Client updated" });
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <h2 className="text-xl font-semibold">Client not found</h2>
          <Button variant="link" onClick={() => navigate("/clients")} className="mt-2">
            ← Back to Clients
          </Button>
        </div>
      </AppLayout>
    );
  }

  const primaryContact = contacts.find((c) => c.is_primary);
  const leadOwnerName = getProfileName(profiles, client.lead_owner_id);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/clients")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
                {client.is_sia && (
                  <Badge variant="secondary" className="text-xs">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    SIA
                  </Badge>
                )}
              </div>
              {primaryContact && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Primary: {primaryContact.first_name} {primaryContact.last_name}
                  {primaryContact.title ? ` · ${primaryContact.title}` : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setProposalsOpen(true)}>
              <FileText className="h-4 w-4 mr-1.5" />
              Proposals
            </Button>
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => navigate("/proposals")}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Proposal
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/projects")}>
              <FolderOpen className="h-4 w-4 mr-1.5" />
              Projects
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{client.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <InfoRow label="Type" value={(client as any).client_type} />
                {client.address && (
                  <p className="text-muted-foreground">{client.address}</p>
                )}
                <InfoRow label="Email" value={client.email} />
                <InfoRow label="Phone (Office)" value={formatPhone(client.phone)} />
                <InfoRow label="Fax" value={formatPhone(client.fax)} />
                <InfoRow label="Lead Owner" value={leadOwnerName} />
                <InfoRow label="Tax ID" value={client.tax_id} />
                {client.notes && <InfoRow label="Notes" value={client.notes} />}
              </CardContent>
            </Card>

            {/* Proposals Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Proposals Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <InfoRow label="Proposals" value={stats?.totalProposals?.toString()} />
                <InfoRow label="Sent" value={stats?.proposalsSent?.toString()} />
                <InfoRow label="Converted" value={stats?.proposalsConverted?.toString()} />
                <InfoRow label="Conversion Rate" value={stats ? `${stats.conversionRate}%` : undefined} />
                <InfoRow label="Total Value" value={stats ? formatCurrency(stats.totalValue) : undefined} />
                <InfoRow label="Active Projects" value={stats?.activeProjects?.toString()} />
                <InfoRow label="Total Projects" value={stats?.totalProjects?.toString()} />
              </CardContent>
            </Card>
          </div>

          {/* Right: Contacts + Reviews */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    Contacts
                    <Badge variant="secondary" className="text-xs">{contacts.length}</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedContacts.size > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setBulkDeleteOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete ({selectedContacts.size})
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setAddContactOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Contact
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {contactsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">No contacts yet.</p>
                    <p className="text-xs mt-1">Click Add Contact to add people.</p>
                  </div>
                ) : (
                  <div>
                    {/* Table Header */}
                    <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <div className="w-8 shrink-0 flex items-center">
                        <Checkbox
                          checked={selectedContacts.size === contacts.length && contacts.length > 0}
                          onCheckedChange={toggleSelectAll}
                          className="h-3.5 w-3.5"
                        />
                      </div>
                      <div className="w-5 shrink-0" />
                      <div className="flex-1 min-w-[140px]">Name</div>
                      <div className="w-[120px] shrink-0 hidden sm:block">Title</div>
                      <div className="w-[120px] shrink-0 hidden md:block">Mobile</div>
                      <div className="w-[180px] shrink-0 hidden lg:block">Email</div>
                      <div className="w-10 shrink-0" />
                    </div>

                    {/* Contact Rows */}
                    {contacts.map((contact) => (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        profiles={profiles}
                        isSelected={selectedContacts.has(contact.id)}
                        isExpanded={expandedContact === contact.id}
                        onToggleSelect={() => toggleSelect(contact.id)}
                        onToggleExpand={() =>
                          setExpandedContact(expandedContact === contact.id ? null : contact.id)
                        }
                        onDelete={() => setDeleteContactId(contact.id)}
                        onContactUpdated={() => {
                          queryClient.invalidateQueries({ queryKey: ["client-contacts", id] });
                          queryClient.invalidateQueries({ queryKey: ["client-detail", id] });
                        }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reviews */}
            {id && <ReviewsSection clientId={id} contacts={contacts} />}
          </div>
        </div>
      </div>

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleUpdate}
        client={client}
        isLoading={updateClient.isPending}
      />

      {id && (
        <AddContactDialog
          open={addContactOpen}
          onOpenChange={setAddContactOpen}
          clientId={id}
        />
      )}

      {id && (
        <ClientProposalsModal
          open={proposalsOpen}
          onOpenChange={setProposalsOpen}
          clientId={id}
          clientName={client.name}
        />
      )}


      {/* Delete Client */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {client.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the client, all their contacts, and unlink any proposals and projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteClient.isPending}
            >
              {deleteClient.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single Contact */}
      <AlertDialog open={!!deleteContactId} onOpenChange={(open) => { if (!open) setDeleteContactId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this contact from the client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Contacts */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedContacts.size} contact(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected contacts from this client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

/* ─── Contact Row (table-style collapsible with inline editing) ─── */

interface ContactRowProps {
  contact: ClientContact;
  profiles: Profile[];
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onDelete: () => void;
  onContactUpdated: () => void;
}

function ContactRow({
  contact,
  profiles,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onDelete,
  onContactUpdated,
}: ContactRowProps) {
  const [form, setForm] = useState({
    first_name: contact.first_name || "",
    last_name: contact.last_name || "",
    title: contact.title || "",
    email: contact.email || "",
    phone: contact.phone || "",
    mobile: contact.mobile || "",
    fax: contact.fax || "",
    linkedin_url: contact.linkedin_url || "",
    lead_owner_id: contact.lead_owner_id || "",
    address_1: contact.address_1 || "",
    address_2: contact.address_2 || "",
    city: contact.city || "",
    state: contact.state || "",
    zip: contact.zip || "",
    is_primary: contact.is_primary,
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const update = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("client_contacts")
        .update({
          name: [form.first_name, form.last_name].filter(Boolean).join(" "),
          first_name: form.first_name,
          last_name: form.last_name || null,
          title: form.title || null,
          email: form.email || null,
          phone: form.phone || null,
          mobile: form.mobile || null,
          fax: form.fax || null,
          linkedin_url: form.linkedin_url || null,
          lead_owner_id: form.lead_owner_id || null,
          address_1: form.address_1 || null,
          address_2: form.address_2 || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          is_primary: form.is_primary,
        })
        .eq("id", contact.id);
      if (!error) {
        setDirty(false);
        onContactUpdated();
      }
    } finally {
      setSaving(false);
    }
  };

  const profileOptions = profiles.map((p) => ({
    value: p.id,
    label: p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
  }));

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      {/* Row */}
      <div
        className={`flex items-center gap-3 px-4 py-2.5 border-b transition-colors cursor-pointer ${
          isSelected ? "bg-primary/5" : "hover:bg-muted/40"
        }`}
      >
        <div className="w-8 shrink-0 flex items-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="h-3.5 w-3.5"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <CollapsibleTrigger asChild>
          <button className="w-5 shrink-0 flex items-center justify-center">
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleTrigger asChild>
          <button className="flex-1 flex items-center gap-3 text-left min-w-0">
            <div className="flex-1 min-w-[140px] flex items-center gap-1.5">
              {contact.is_primary && (
                <Star className="h-3 w-3 text-accent fill-accent shrink-0" />
              )}
              <span className="font-medium text-sm truncate">
                {contact.first_name} {contact.last_name}
              </span>
            </div>
            <div className="w-[120px] shrink-0 hidden sm:block text-sm text-muted-foreground truncate">
              {contact.title || "—"}
            </div>
            <div className="w-[120px] shrink-0 hidden md:block text-sm text-muted-foreground truncate">
              {formatPhone(contact.mobile) || "—"}
            </div>
            <div className="w-[180px] shrink-0 hidden lg:block text-sm truncate">
              {contact.email ? (
                <span className="text-primary">{contact.email}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <div className="w-10 shrink-0 flex items-center justify-end">
          <MoreActions contact={contact} onDelete={onDelete} />
        </div>
      </div>

      {/* Expanded Inline Edit Panel */}
      <CollapsibleContent>
        <div className="border-b bg-muted/20">
          <div className="px-4 py-4 ml-[52px] space-y-3">
            {/* Name */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">First Name *</Label>
                <Input className="h-8 text-sm" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Last Name</Label>
                <Input className="h-8 text-sm" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Title / Role</Label>
                <Input className="h-8 text-sm" value={form.title} onChange={(e) => update("title", e.target.value)} />
              </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Address 1</Label>
                <Input className="h-8 text-sm" value={form.address_1} onChange={(e) => update("address_1", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Address 2</Label>
                <Input className="h-8 text-sm" value={form.address_2} onChange={(e) => update("address_2", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">City</Label>
                <Input className="h-8 text-sm" value={form.city} onChange={(e) => update("city", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">State</Label>
                <Input className="h-8 text-sm" value={form.state} onChange={(e) => update("state", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Zip</Label>
                <Input className="h-8 text-sm" value={form.zip} onChange={(e) => update("zip", e.target.value)} />
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input className="h-8 text-sm" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input className="h-8 text-sm" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Mobile</Label>
                <Input className="h-8 text-sm" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fax</Label>
                <Input className="h-8 text-sm" value={form.fax} onChange={(e) => update("fax", e.target.value)} />
              </div>
            </div>

            {/* LinkedIn & Lead Owner */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Linkedin className="h-3 w-3" /> LinkedIn URL
                </Label>
                <Input className="h-8 text-sm" value={form.linkedin_url} onChange={(e) => update("linkedin_url", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Lead Owner</Label>
                <Select
                  value={form.lead_owner_id || "none"}
                  onValueChange={(v) => { update("lead_owner_id", v === "none" ? "" : v); }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {profileOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-4">
                <Switch checked={form.is_primary} onCheckedChange={(v) => update("is_primary", v)} />
                <Label className="text-xs text-muted-foreground">Primary</Label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              {dirty && (
                <Button
                  size="sm"
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={handleSave}
                  disabled={saving || !form.first_name.trim()}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Save
                </Button>
              )}
              {contact.email && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`mailto:${contact.email}`}>
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    Email
                  </a>
                </Button>
              )}
              {(contact.phone || contact.mobile) && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${contact.mobile || contact.phone}`}>
                    <Phone className="h-3.5 w-3.5 mr-1" />
                    Call
                  </a>
                </Button>
              )}
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ─── More Actions Dropdown ─── */

function MoreActions({
  contact,
  onDelete,
}: {
  contact: ClientContact;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {contact.email && (
          <DropdownMenuItem asChild>
            <a href={`mailto:${contact.email}`}>
              <Mail className="h-3.5 w-3.5 mr-2" />
              Send Email
            </a>
          </DropdownMenuItem>
        )}
        {(contact.phone || contact.mobile) && (
          <DropdownMenuItem asChild>
            <a href={`tel:${contact.mobile || contact.phone}`}>
              <Phone className="h-3.5 w-3.5 mr-2" />
              Call
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Shared UI ─── */

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground font-medium shrink-0">{label}:</span>
      <span className="text-right truncate">{value}</span>
    </div>
  );
}

function DetailRow({
  label,
  value,
  isLink,
}: {
  label: string;
  value?: string | null;
  isLink?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      {isLink ? (
        <a href={isLink} className="text-primary hover:underline text-sm truncate">
          {value}
        </a>
      ) : (
        <span className="truncate">{value}</span>
      )}
    </div>
  );
}
