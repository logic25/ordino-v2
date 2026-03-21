import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ChevronDown, ChevronRight, Plus, AlertTriangle, Send, Mail, Phone,
  ExternalLink, Pencil, UserPlus, User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AddContactDialog } from "@/components/clients/AddContactDialog";
import { EditContactDialog } from "@/components/clients/EditContactDialog";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { dobRoleLabels } from "@/components/projects/projectMockData";
import type { MockContact, MockPISStatus } from "@/components/projects/projectMockData";

const sourceStyles: Record<string, { label: string; className: string }> = {
  proposal: { label: "Proposal", className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  pis: { label: "PIS", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800" },
  manual: { label: "Manual", className: "bg-muted text-muted-foreground" },
};

const dobRegStyles: Record<string, { label: string; className: string; icon: string }> = {
  registered: { label: "Registered", className: "text-emerald-600 dark:text-emerald-400", icon: "✓" },
  not_registered: { label: "Not Registered", className: "text-red-600 dark:text-red-400", icon: "✗" },
  unknown: { label: "Unknown", className: "text-muted-foreground", icon: "?" },
};

export function ContactsFull({ contacts, pisStatus, projectId, clientId }: { contacts: MockContact[]; pisStatus: MockPISStatus; projectId?: string; clientId?: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<MockContact | null>(null);
  const toggle = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ["all-clients-with-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, email, phone, client_contacts(id, name, email, phone, title)")
        .order("name");
      return data || [];
    },
  });

  const filteredClients = allClients.filter(c =>
    !searchTerm ||
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.client_contacts || []).some((cc: any) => cc.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleLinkContact = async (contact: { id: string; name: string }) => {
    if (contacts.some(c => c.id === contact.id)) {
      toast({ title: "Already linked", description: `${contact.name} is already on this project.` });
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await (supabase.from("project_contacts" as any) as any).insert({
        project_id: projectId,
        contact_id: contact.id,
        company_id: profile.company_id,
      });
      if (error) throw error;
      toast({ title: "Contact linked", description: `${contact.name} is now associated with this project.` });
      queryClient.invalidateQueries({ queryKey: ["project-contacts"] });
    } catch (err: any) {
      toast({ title: "Error linking contact", description: err.message, variant: "destructive" });
    }
    setSearchOpen(false);
    setSearchTerm("");
  };

  const handleNewClientCreated = (clientId: string) => {
    setSelectedClientId(clientId);
    setShowNewClientDialog(false);
    setShowNewContactDialog(true);
    queryClient.invalidateQueries({ queryKey: ["all-clients-with-contacts"] });
  };

  return (
    <div>
      {pisStatus.completedFields < pisStatus.totalFields && (
        <div className="flex items-center gap-3 px-6 py-3 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-200/50 dark:border-amber-800/30 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span>PIS sent {pisStatus.sentDate} — {pisStatus.completedFields} of {pisStatus.totalFields} fields completed</span>
          <Button variant="outline" size="sm" className="ml-auto shrink-0 gap-1.5">
            <Send className="h-3.5 w-3.5" /> Follow Up
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between px-6 py-3 border-b">
        <span className="text-sm text-muted-foreground">{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</span>
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Contact
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-0" align="end">
            <div className="p-2 border-b">
              <Input
                placeholder="Search companies or contacts..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {filteredClients.length === 0 && searchTerm.trim() ? (
                <div className="p-2">
                  <p className="px-3 py-2 text-sm text-muted-foreground">No matches for &ldquo;{searchTerm}&rdquo;</p>
                  {clientId && (
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                      onClick={() => {
                        setSelectedClientId(clientId);
                        setSearchOpen(false);
                        setShowNewContactDialog(true);
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                      Create &ldquo;{searchTerm}&rdquo; as new contact
                    </button>
                  )}
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                    onClick={() => {
                      setSearchOpen(false);
                      setShowNewClientDialog(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    New company &amp; contact
                  </button>
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Start typing to search...</div>
              ) : (
                <>
                  {filteredClients.slice(0, 15).map(client => (
                    <div key={client.id}>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                        {client.name}
                      </div>
                      {(client.client_contacts || []).length > 0 ? (
                        (client.client_contacts || []).map((cc: any) => {
                          const alreadyAdded = contacts.some(c => c.id === cc.id);
                          return (
                            <button
                              key={cc.id}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors ${alreadyAdded ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50"}`}
                              disabled={alreadyAdded}
                              onClick={() => handleLinkContact(cc)}
                            >
                              <div className="flex items-center justify-between">
                                <span>{cc.name}</span>
                                {alreadyAdded && <span className="text-[10px] text-muted-foreground">linked</span>}
                              </div>
                              {(cc.title || cc.email) && (
                                <div className="text-xs text-muted-foreground">{[cc.title, cc.email].filter(Boolean).join(" · ")}</div>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <button
                          className="w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2 text-muted-foreground"
                          onClick={() => {
                            setSelectedClientId(client.id);
                            setSearchOpen(false);
                            setShowNewContactDialog(true);
                          }}
                        >
                          <UserPlus className="h-3.5 w-3.5" /> Add contact to {client.name}
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="border-t">
                    {searchTerm.trim() && clientId && (
                      <button
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                        onClick={() => {
                          setSelectedClientId(clientId);
                          setSearchOpen(false);
                          setShowNewContactDialog(true);
                        }}
                      >
                        <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        Create &ldquo;{searchTerm}&rdquo; as new contact
                      </button>
                    )}
                    <button
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                      onClick={() => {
                        setSearchOpen(false);
                        setShowNewClientDialog(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      New Company &amp; Contact
                    </button>
                  </div>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <ClientDialog
        open={showNewClientDialog}
        onOpenChange={setShowNewClientDialog}
        onSubmit={async (data) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");
          const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
          if (!profile?.company_id) throw new Error("No company");
          const { data: newClient, error } = await supabase.from("clients").insert({
            ...data,
            company_id: profile.company_id,
          }).select("id").single();
          if (error) throw error;
          toast({ title: "Company created", description: `${data.name} created. Now add a contact.` });
          handleNewClientCreated(newClient.id);
        }}
      />

      {selectedClientId && (
        <AddContactDialog
          open={showNewContactDialog}
          onOpenChange={setShowNewContactDialog}
          clientId={selectedClientId}
          defaultName={searchTerm.trim() || undefined}
          onContactCreated={(contact) => {
            if (contact && projectId) {
              supabase.auth.getUser().then(({ data: { user } }) => {
                if (!user) return;
                supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle().then(({ data: profile }) => {
                  if (!profile?.company_id) return;
                  (supabase.from("project_contacts" as any) as any).insert({
                    project_id: projectId,
                    contact_id: contact.id,
                    company_id: profile.company_id,
                  }).then(({ error }: any) => {
                    if (error) console.error("Failed to link contact:", error);
                    queryClient.invalidateQueries({ queryKey: ["project-contacts"] });
                  });
                });
              });
            }
            queryClient.invalidateQueries({ queryKey: ["project-contacts"] });
            queryClient.invalidateQueries({ queryKey: ["all-clients-with-contacts"] });
            setShowNewContactDialog(false);
            setSelectedClientId(null);
          }}
        />
      )}

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[36px]" />
            <TableHead>Name</TableHead>
            <TableHead>DOB Role</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>DOB NOW</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => {
            const src = sourceStyles[c.source] || sourceStyles.manual;
            const reg = dobRegStyles[c.dobRegistered] || dobRegStyles.unknown;
            const isExpanded = expandedIds.has(c.id);
            return (
              <>
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/20" onClick={() => toggle(c.id)}>
                  <TableCell className="pr-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{dobRoleLabels[c.dobRole]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.company}</TableCell>
                  <TableCell>
                    <a href={`tel:${c.phone}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={e => e.stopPropagation()}>
                      {c.phone}
                    </a>
                  </TableCell>
                  <TableCell>
                    <a href={`mailto:${c.email}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={e => e.stopPropagation()}>
                      {c.email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${src.className}`}>{src.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${reg.className}`}>{reg.icon} {reg.label}</span>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${c.id}-detail`} className="hover:bg-transparent">
                    <TableCell colSpan={8} className="p-0">
                        <div className="px-8 py-4 bg-muted/10 text-sm space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <div><span className="text-muted-foreground">Role:</span> {c.role}</div>
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                <a href={`tel:${c.phone}`} className="hover:text-foreground transition-colors">{c.phone || "—"}</a>
                              </div>
                              <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <a href={`mailto:${c.email}`} className="hover:text-foreground transition-colors">{c.email || "—"}</a>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground">DOB NOW Verified:</span>
                                  <Button
                                    variant={c.dobRegistered === "registered" ? "default" : "outline"}
                                    size="sm"
                                    className="h-6 text-[10px] px-2"
                                    onClick={() => toast({ title: "Status toggled", description: `${c.name} DOB NOW status updated.` })}
                                  >
                                    {c.dobRegistered === "registered" ? "✓ Verified" : "Mark Verified"}
                                  </Button>
                                </div>
                                {c.dobRegistered === "not_registered" && (
                                  <span className="text-xs text-destructive flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Filing may be blocked
                                  </span>
                                )}
                              </div>
                            </div>
                            <div>
                              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Review</h5>
                              {c.review ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <span key={i} className={`text-sm ${i < (c.review?.rating || 0) ? "text-amber-500" : "text-muted-foreground/30"}`}>★</span>
                                    ))}
                                    <span className="text-xs text-muted-foreground ml-1">{c.review.rating}/5</span>
                                  </div>
                                  {c.review.comment && <p className="text-xs text-muted-foreground italic">"{c.review.comment}"</p>}
                                </div>
                              ) : (
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => toast({ title: "Add Review", description: `Opening review form for ${c.company}` })}>
                                  <Plus className="h-3 w-3" /> Add Review
                                </Button>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 items-end justify-start">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs"
                                onClick={(e) => { e.stopPropagation(); setEditingContact(c); }}
                              >
                                <Pencil className="h-3 w-3" /> Edit Contact
                              </Button>
                              {c.client_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/clients?id=${c.client_id}`); }}
                                >
                                  <ExternalLink className="h-3 w-3" /> Go to Company
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>

      <EditContactDialog
        open={!!editingContact}
        onOpenChange={(open) => { if (!open) setEditingContact(null); }}
        contact={editingContact ? {
          id: editingContact.id,
          client_id: editingContact.client_id || "",
          company_id: "",
          name: editingContact.name,
          first_name: editingContact.first_name || editingContact.name.split(" ")[0] || "",
          last_name: editingContact.last_name || editingContact.name.split(" ").slice(1).join(" ") || "",
          email: editingContact.email || null,
          phone: editingContact.phone || null,
          title: editingContact.title || null,
          is_primary: editingContact.is_primary || false,
          mobile: null,
          fax: null,
          linkedin_url: null,
          lead_owner_id: null,
          address_1: null,
          address_2: null,
          city: null,
          state: null,
          zip: null,
          company_name: editingContact.company || null,
          notes: null,
          sort_order: 0,
          created_at: "",
          updated_at: "",
          license_type: null,
          license_number: null,
          specialty: null,
        } : null}
      />
    </div>
  );
}
