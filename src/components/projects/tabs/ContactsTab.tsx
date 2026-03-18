import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Pencil, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { MockContact } from "../projectMockData";
import { dobRoleLabels, engineerDisciplineLabels } from "../projectMockData";

export function ContactsTab({ contacts }: { contacts: MockContact[] }) {
  const { toast } = useToast();

  const handleEdit = (contact: MockContact) => {
    toast({ title: "Edit Contact", description: `Editing ${contact.name} — form coming soon.` });
  };

  const handleDelete = (contact: MockContact) => {
    toast({ title: "Delete Contact", description: `${contact.name} would be removed from this project.`, variant: "destructive" });
  };

  return (
    <div className="p-4 space-y-2">
      {contacts.map((c) => (
        <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-background border group">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{c.name}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{dobRoleLabels[c.dobRole]}</Badge>
              {c.dobRole === "engineer" && c.discipline && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {engineerDisciplineLabels[c.discipline]}
                </Badge>
              )}
              {c.dobRegistered === "not_registered" && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">Not DOB Registered</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{c.role} · {c.company}</div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Phone className="h-3 w-3" /> {c.phone}
            </a>
            <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Mail className="h-3 w-3" /> {c.email}
            </a>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(c)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDelete(c)}>
                <XCircle className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
