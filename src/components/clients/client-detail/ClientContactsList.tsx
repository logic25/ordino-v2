import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Phone, Star, User, Linkedin } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  is_primary: boolean;
  linkedin_url: string | null;
}

interface Props {
  contacts: Contact[];
  isLoading: boolean;
}

export function ClientContactsList({ contacts, isLoading }: Props) {
  const primaryContact = contacts.find((c) => c.is_primary);
  const otherContacts = contacts.filter((c) => !c.is_primary);
  const orderedContacts = [...(primaryContact ? [primaryContact] : []), ...otherContacts];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <User className="h-3.5 w-3.5" />
        People ({contacts.length})
      </h3>
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts added yet</p>
      ) : (
        <div className="space-y-2">
          {orderedContacts.map((contact) => (
            <div key={contact.id} className="p-3 rounded-lg border bg-muted/30 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{contact.name}</span>
                {contact.is_primary && (
                  <Badge variant="default" className="text-xs h-5 gap-1">
                    <Star className="h-3 w-3" />
                    Primary
                  </Badge>
                )}
                {contact.title && (
                  <span className="text-xs text-muted-foreground">· {contact.title}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Mail className="h-3 w-3" />{contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="text-xs hover:underline flex items-center gap-1">
                    <Phone className="h-3 w-3" />{contact.phone}
                  </a>
                )}
                {contact.linkedin_url && (
                  <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Linkedin className="h-3 w-3" />LinkedIn
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
