import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Calendar, CheckCircle, Clock, AlertTriangle, MoreHorizontal,
  PhoneCall, RefreshCw, DollarSign, XCircle,
} from "lucide-react";
import { useAllPaymentPromises, useUpdatePaymentPromise } from "@/hooks/usePaymentPromises";
import { toast } from "@/hooks/use-toast";
import {
  isToday, isTomorrow, isThisWeek, isBefore, startOfToday, format, parseISO,
} from "date-fns";

const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-primary/10 text-primary border-primary/30", icon: Clock },
  kept: { label: "Kept", className: "bg-success/10 text-success border-success/30", icon: CheckCircle },
  broken: { label: "Broken", className: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  rescheduled: { label: "Rescheduled", className: "bg-warning/10 text-warning border-warning/30", icon: RefreshCw },
};

type FilterStatus = "all" | "pending" | "kept" | "broken" | "rescheduled";

export function PromisesView() {
  const { data: promises = [], isLoading } = useAllPaymentPromises();
  const updatePromise = useUpdatePaymentPromise();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const filtered = useMemo(() => {
    if (filterStatus === "all") return promises;
    return promises.filter((p) => p.status === filterStatus);
  }, [promises, filterStatus]);

  const groups = useMemo(() => {
    const today = startOfToday();
    const overdue: typeof filtered = [];
    const todayGroup: typeof filtered = [];
    const tomorrowGroup: typeof filtered = [];
    const thisWeekGroup: typeof filtered = [];
    const later: typeof filtered = [];

    filtered.forEach((p) => {
      const date = parseISO(p.promised_date);
      if (p.status === "pending" && isBefore(date, today)) {
        overdue.push(p);
      } else if (isToday(date)) {
        todayGroup.push(p);
      } else if (isTomorrow(date)) {
        tomorrowGroup.push(p);
      } else if (isThisWeek(date, { weekStartsOn: 1 })) {
        thisWeekGroup.push(p);
      } else {
        later.push(p);
      }
    });

    return [
      { key: "overdue", label: "Overdue", items: overdue, icon: AlertTriangle, colorClass: "text-destructive" },
      { key: "today", label: "Today", items: todayGroup, icon: Calendar, colorClass: "text-primary" },
      { key: "tomorrow", label: "Tomorrow", items: tomorrowGroup, icon: Clock, colorClass: "text-muted-foreground" },
      { key: "this_week", label: "This Week", items: thisWeekGroup, icon: Calendar, colorClass: "text-muted-foreground" },
      { key: "later", label: "Later", items: later, icon: Calendar, colorClass: "text-muted-foreground" },
    ].filter((g) => g.items.length > 0);
  }, [filtered]);

  const summary = useMemo(() => {
    const pending = promises.filter((p) => p.status === "pending");
    const kept = promises.filter((p) => p.status === "kept");
    const broken = promises.filter((p) => p.status === "broken");
    const totalPending = pending.reduce((s, p) => s + (p.promised_amount || 0), 0);
    return { pending: pending.length, kept: kept.length, broken: broken.length, totalPending };
  }, [promises]);

  const handleMarkKept = async (id: string) => {
    try {
      await updatePromise.mutateAsync({ id, status: "kept", actual_payment_date: new Date().toISOString().split("T")[0] });
      toast({ title: "Promise marked as kept" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleMarkBroken = async (id: string) => {
    try {
      await updatePromise.mutateAsync({ id, status: "broken" });
      toast({ title: "Promise marked as broken" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">Loading promises...</div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <div>
              <div className="text-lg font-bold">{summary.pending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <div>
              <div className="text-lg font-bold" data-clarity-mask="true">
                ${summary.totalPending.toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-muted-foreground">Expected</div>
            </div>
          </div>
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <div>
              <div className="text-lg font-bold">{summary.kept}</div>
              <div className="text-xs text-muted-foreground">Kept</div>
            </div>
          </div>
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <div>
              <div className="text-lg font-bold">{summary.broken}</div>
              <div className="text-xs text-muted-foreground">Broken</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5">
        {(["all", "pending", "kept", "broken", "rescheduled"] as FilterStatus[]).map((s) => (
          <Button
            key={s}
            variant={filterStatus === s ? "default" : "outline"}
            size="sm"
            className="text-xs h-7 capitalize"
            onClick={() => setFilterStatus(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      {/* Grouped list */}
      {groups.length === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No payment promises found.
        </div>
      )}

      {groups.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.key}>
            <div className="flex items-center gap-2 mb-2">
              <GroupIcon className={`h-4 w-4 ${group.colorClass}`} />
              <h3 className={`text-sm font-semibold ${group.colorClass}`}>{group.label}</h3>
              <Badge variant="outline" className="text-[10px]">{group.items.length}</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Promise Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((promise) => {
                  const config = statusConfig[promise.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={promise.id}>
                      <TableCell className="font-mono text-sm">
                        {(promise as any).invoices?.invoice_number || "—"}
                      </TableCell>
                      <TableCell data-clarity-mask="true">
                        {(promise as any).invoices?.clients?.name || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium" data-clarity-mask="true">
                        ${(promise.promised_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(promise.promised_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="capitalize text-sm text-muted-foreground" data-clarity-mask="true">
                        {promise.payment_method || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${config.className}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {promise.status === "pending" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover border shadow-md">
                              <DropdownMenuItem onClick={() => handleMarkKept(promise.id)}>
                                <CheckCircle className="h-4 w-4 mr-2 text-success" />
                                Mark as Received
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleMarkBroken(promise.id)}>
                                <XCircle className="h-4 w-4 mr-2 text-destructive" />
                                Mark as Broken
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <PhoneCall className="h-4 w-4 mr-2" />
                                Follow Up
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Separator className="my-3" />
          </div>
        );
      })}
    </div>
  );
}
