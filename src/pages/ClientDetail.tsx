import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { EditContactDialog } from "@/components/clients/EditContactDialog";
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
  const [editContact, setEditContact] = useState<ClientContact | null>(null);
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
                <CardTitle className="text-base">Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <InfoRow label="Name" value={client.name} />
                <InfoRow label="Email" value={client.email} />
                <InfoRow label="Phone" value={client.phone} />
                <InfoRow label="Fax" value={client.fax} />
                <InfoRow label="Address" value={client.address} />
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

          {/* Right: Contacts */}
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
            <CardContent>
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
                <div className="space-y-1">
                  {/* Select All */}
                  <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={selectedContacts.size === contacts.length && contacts.length > 0}
                      onCheckedChange={toggleSelectAll}
                      className="h-3.5 w-3.5"
                    />
                    <span>Select all</span>
                  </div>

                  {contacts.map((contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      profiles={profiles}
                      isSelected={selectedContacts.has(contact.id)}
                      isExpanded={expandedContact === contact.id}
                      onToggleSelect={() => toggleSelect(contact.id)}
                      onToggleExpand={() =>
                        setExpandedContact(expandedContact === contact.id ? null : contact.id)
                      }
                      onEdit={() => setEditContact(contact)}
                      onDelete={() => setDeleteContactId(contact.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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

      <EditContactDialog
        open={!!editContact}
        onOpenChange={(open) => { if (!open) setEditContact(null); }}
        contact={editContact}
      />

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

/* ─── Contact Card ─── */

interface ContactCardProps {
  contact: ClientContact;
  profiles: Profile[];
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ContactCard({
  contact,
  profiles,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onEdit,
  onDelete,
}: ContactCardProps) {
  const leadOwner = contact.lead_owner_id
    ? profiles.find((p) => p.id === contact.lead_owner_id)
    : null;
  const leadOwnerName = leadOwner
    ? leadOwner.display_name || `${leadOwner.first_name || ""} ${leadOwner.last_name || ""}`.trim()
    : null;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div
        className={`rounded-lg border transition-colors ${
          isSelected ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-muted/40"
        }`}
      >
        {/* Summary Row */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="h-4 w-4"
            onClick={(e) => e.stopPropagation()}
          />

          <CollapsibleTrigger asChild>
            <button className="flex-1 flex items-center gap-3 text-left min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {contact.is_primary && (
                  <Star className="h-3.5 w-3.5 text-accent fill-accent shrink-0" />
                )}
                <span className="font-medium text-sm truncate">
                  {contact.first_name} {contact.last_name}
                </span>
                {contact.title && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    · {contact.title}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                {contact.email && (
                  <span className="text-xs hidden md:inline truncate max-w-[160px]">{contact.email}</span>
                )}
                {contact.phone && (
                  <span className="text-xs hidden lg:inline">{contact.phone}</span>
                )}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </div>
            </button>
          </CollapsibleTrigger>
        </div>

        {/* Expanded Details */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 py-3 text-sm">
              <DetailRow label="Email" value={contact.email} isLink={`mailto:${contact.email}`} />
              <DetailRow label="Phone" value={contact.phone} isLink={`tel:${contact.phone}`} />
              <DetailRow label="Mobile" value={contact.mobile} isLink={`tel:${contact.mobile}`} />
              <DetailRow label="Fax" value={contact.fax} />
              <DetailRow label="Company" value={contact.company_name} />
              <DetailRow label="Title" value={contact.title} />
              {contact.linkedin_url && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">LinkedIn:</span>
                  <a
                    href={contact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-sm"
                  >
                    <Linkedin className="h-3.5 w-3.5" /> Profile
                  </a>
                </div>
              )}
              <DetailRow label="Lead Owner" value={leadOwnerName} />
              {(contact.address_1 || contact.city) && (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Address: </span>
                  <span>
                    {[contact.address_1, contact.address_2, contact.city, contact.state, contact.zip]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
              {contact.email && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`mailto:${contact.email}`}>
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    Email
                  </a>
                </Button>
              )}
              {contact.phone && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${contact.phone}`}>
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
        </CollapsibleContent>
      </div>
    </Collapsible>
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
    <div className="flex justify-between gap-2">
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
