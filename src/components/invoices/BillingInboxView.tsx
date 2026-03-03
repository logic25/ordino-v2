import { useState } from "react";
import { format } from "date-fns";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Receipt } from "lucide-react";
import {
  useBillingRequests,
  useCreateInvoiceFromRequest,
  useRejectBillingRequest,
  type BillingRequestWithRelations,
} from "@/hooks/useBillingRequests";
import { toast } from "@/hooks/use-toast";

export function BillingInboxView() {
  const { data: requests = [], isLoading } = useBillingRequests("pending");
  const createInvoice = useCreateInvoiceFromRequest();
  const rejectRequest = useRejectBillingRequest();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleCreateInvoice = async (req: BillingRequestWithRelations) => {
    setProcessingId(req.id);
    try {
      await createInvoice.mutateAsync(req);
      toast({ title: "Invoice created", description: `Invoice created for ${req.projects?.project_number || "project"}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await rejectRequest.mutateAsync(id);
      toast({ title: "Request rejected" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateAll = async () => {
    for (const req of requests) {
      await handleCreateInvoice(req);
    }
  };

  const totalAmount = requests.reduce((s, r) => s + r.total_amount, 0);

  return (
    <div className="space-y-4 py-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {requests.length} pending billing request{requests.length !== 1 ? "s" : ""} totaling{" "}
            <span className="font-semibold text-foreground tabular-nums">
              ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>
        {requests.length > 1 && (
          <Button size="sm" onClick={handleCreateAll} disabled={!!processingId}>
            <Receipt className="h-4 w-4 mr-1.5" />
            Create All Invoices
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Services</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Submitted By</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell>
            </TableRow>
          ) : requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
                  <p>All caught up — no pending billing requests</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            requests.map((req) => {
              const services = (req.services as any[]) || [];
              const serviceNames = services.map((s) => s.name || s.description || "Service").join(", ");
              const isProcessing = processingId === req.id;

              return (
                <TableRow key={req.id}>
                  <TableCell className="text-sm tabular-nums">
                    {format(new Date(req.created_at), "MM/dd/yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{req.projects?.project_number || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {req.projects?.name || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm truncate max-w-[200px]">{serviceNames}</div>
                    <div className="text-xs text-muted-foreground">{services.length} item{services.length !== 1 ? "s" : ""}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-sm">
                    ${req.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {req.created_by_profile
                      ? `${req.created_by_profile.first_name || ""} ${req.created_by_profile.last_name || ""}`.trim()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isProcessing}
                        onClick={() => handleCreateInvoice(req)}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Receipt className="h-3.5 w-3.5 mr-1" />
                            Create Invoice
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={isProcessing}
                        onClick={() => handleReject(req.id)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
