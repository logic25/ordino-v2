import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, FileText } from "lucide-react";
import { format } from "date-fns";

interface ClientProposalsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  viewed: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  executed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export function ClientProposalsModal({ open, onOpenChange, clientId, clientName }: ClientProposalsModalProps) {
  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["client-proposals", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, title, proposal_number, status, total_amount, created_at, sent_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!clientId,
  });

  const totalValue = proposals.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const accepted = proposals.filter((p) => p.status === "executed").length;
  const sent = proposals.filter((p) => p.status !== "draft").length;
  const conversionRate = sent > 0 ? Math.round((accepted / sent) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Proposals — {clientName}
          </DialogTitle>
        </DialogHeader>

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Total" value={proposals.length.toString()} />
          <MetricCard label="Sent" value={sent.toString()} />
          <MetricCard label="Converted" value={accepted.toString()} sub={`${conversionRate}%`} />
          <MetricCard label="Total Value" value={formatCurrency(totalValue)} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No proposals for this client yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.proposal_number || "—"}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{p.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${statusColors[p.status || "draft"] || ""}`}>
                        {(p.status || "draft").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {p.total_amount ? formatCurrency(p.total_amount) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.created_at ? format(new Date(p.created_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
