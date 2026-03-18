import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronRight, ChevronDown, ExternalLink, Send, XCircle, CheckCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ServiceDetail } from "./ServiceDetail";
import type { MockService } from "../projectMockData";
import { serviceStatusStyles, formatCurrency } from "../projectMockData";

export function ServicesTab({ services }: { services: MockService[] }) {
  const [expandedServiceIds, setExpandedServiceIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleService = (id: string) => {
    setExpandedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === services.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(services.map((s) => s.id)));
  };

  const handleBulkAction = (action: string) => {
    toast({ title: action, description: `${selectedIds.size} service(s) selected. This action will be wired to the backend.` });
  };

  const handleStartDobNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({ title: "Coming soon", description: "DOB NOW integration is under development." });
  };

  const total = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const billed = services.reduce((s, svc) => s + svc.billedAmount, 0);
  const cost = services.reduce((s, svc) => s + svc.costAmount, 0);
  const remaining = total - billed;

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 border-b flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">{selectedIds.size} selected:</span>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkAction("Send to Billing")}>
            <Send className="h-3 w-3" /> Send to Billing
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkAction("Mark as Approved")}>
            <CheckCheck className="h-3 w-3" /> Mark Approved
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive border-destructive/30" onClick={() => handleBulkAction("Drop Service")}>
            <XCircle className="h-3 w-3" /> Drop
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[40px]">
              <Checkbox checked={selectedIds.size === services.length && services.length > 0} onCheckedChange={toggleSelectAll} className="h-3.5 w-3.5" />
            </TableHead>
            <TableHead className="w-[30px]" />
            <TableHead className="text-xs uppercase tracking-wider">Service</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Assigned</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Disciplines</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Est. Bill Date</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Price</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Cost</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Sent</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Paid</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((svc) => {
            const sStatus = serviceStatusStyles[svc.status] || serviceStatusStyles.not_started;
            const isExpanded = expandedServiceIds.has(svc.id);

            return (
              <>
                <TableRow key={svc.id} className="cursor-pointer hover:bg-muted/20" onClick={() => toggleService(svc.id)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(svc.id)} onCheckedChange={() => toggleSelect(svc.id)} className="h-3.5 w-3.5" />
                  </TableCell>
                  <TableCell className="pr-0">
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {svc.changeOrderId && <Badge variant="outline" className="mr-1.5 text-[10px] px-1.5 py-0 font-mono border-amber-500/50 text-amber-600 dark:text-amber-400">CO</Badge>}
                    {svc.name}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sStatus.className}`}>{sStatus.label}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{svc.assignedTo}</TableCell>
                  <TableCell>
                    {svc.subServices.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {svc.subServices.map((d) => (
                          <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{d}</Badge>
                        ))}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{svc.estimatedBillDate || "—"}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-medium" data-clarity-mask="true">
                    {formatCurrency(svc.totalAmount)}
                    {svc.depositAmount > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Dep: {formatCurrency(svc.depositAmount)}
                        {svc.depositPaid && <span className="text-emerald-600 dark:text-emerald-400 ml-1">✓</span>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums text-muted-foreground" data-clarity-mask="true">
                    {svc.costAmount > 0 ? formatCurrency(svc.costAmount) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{svc.sentDate || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{svc.paidDate || "—"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {svc.needsDobFiling ? (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleStartDobNow}>
                        <ExternalLink className="h-3 w-3" />Start DOB NOW
                      </Button>
                    ) : svc.application ? (
                      <Badge variant="outline" className="font-mono text-[10px]">#{svc.application.jobNumber} {svc.application.type}</Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${svc.id}-detail`} className="hover:bg-transparent">
                    <TableCell />
                    <TableCell colSpan={11} className="p-0">
                      <ServiceDetail service={svc} />
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>

      <div className="px-4 py-3 bg-muted/20 border-t flex items-center gap-6 text-sm flex-wrap">
        <span><span className="text-muted-foreground">Contract:</span> <span className="font-semibold" data-clarity-mask="true">{formatCurrency(total)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Billed:</span> <span className="font-semibold text-emerald-600 dark:text-emerald-400" data-clarity-mask="true">{formatCurrency(billed)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Remaining:</span> <span className="font-semibold" data-clarity-mask="true">{formatCurrency(remaining)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Cost:</span> <span className="font-semibold" data-clarity-mask="true">{formatCurrency(cost)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Margin:</span> <span className="font-semibold">{total > 0 ? `${Math.round((total - cost) / total * 100)}%` : "—"}</span></span>
      </div>
    </div>
  );
}
