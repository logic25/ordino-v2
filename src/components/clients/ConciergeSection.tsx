import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, ArrowUpRight } from "lucide-react";
import { safeFormatDate } from "@/lib/dateUtils";

interface ConciergeConversation {
  id: string;
  created_at: string;
  sender_email: string | null;
  sender_verified: boolean;
  inbound_subject: string | null;
  inbound_text: string | null;
  matched_intent: string | null;
  intent_confidence: number | null;
  outbound_text: string | null;
  escalated: boolean;
  project_id: string | null;
}

const INTENT_LABEL: Record<string, string> = {
  status: "Status",
  next_step: "Next step",
  invoice: "Invoice",
  book_call: "Book call",
  escalate: "Escalated",
  unverified_sender: "Unverified sender",
  no_projects: "No projects",
};

const INTENT_CLASS: Record<string, string> = {
  status: "bg-sky-50 text-sky-800 ring-sky-200",
  next_step: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  invoice: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  book_call: "bg-violet-50 text-violet-800 ring-violet-200",
  escalate: "bg-amber-50 text-amber-800 ring-amber-200",
  unverified_sender: "bg-red-50 text-red-800 ring-red-200",
  no_projects: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function ConciergeSection({ clientId }: { clientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["concierge-conversations", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("concierge_conversations")
        .select("id, created_at, sender_email, sender_verified, inbound_subject, inbound_text, matched_intent, intent_confidence, outbound_text, escalated, project_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ConciergeConversation[];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Concierge
            {data && data.length > 0 && (
              <Badge variant="secondary" className="text-xs">{data.length}</Badge>
            )}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Client emails answered by Beacon Concierge
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm">No concierge activity yet.</p>
            <p className="text-xs mt-1">
              When this client emails the concierge address, replies and escalations will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {data.map((c) => {
              const intent = c.matched_intent ?? "escalate";
              return (
                <div key={c.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${INTENT_CLASS[intent] ?? INTENT_CLASS.escalate}`}
                    >
                      {INTENT_LABEL[intent] ?? intent}
                    </span>
                    {c.escalated && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                        <ArrowUpRight className="h-3 w-3" /> Escalated to PM
                      </span>
                    )}
                    {!c.sender_verified && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 ring-1 ring-inset ring-red-200">
                        Unverified sender
                      </span>
                    )}
                    <span className="text-muted-foreground ml-auto">
                      {safeFormatDate(c.created_at, "MMM d, yyyy h:mm a")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    From <span className="font-medium text-foreground">{c.sender_email ?? "—"}</span>
                    {c.inbound_subject ? ` · ${c.inbound_subject}` : ""}
                  </div>
                  {c.inbound_text && (
                    <div className="rounded-md bg-muted/40 p-2 text-sm whitespace-pre-wrap">
                      {c.inbound_text}
                    </div>
                  )}
                  {c.outbound_text && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-sm whitespace-pre-wrap">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Concierge reply
                      </div>
                      {c.outbound_text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
