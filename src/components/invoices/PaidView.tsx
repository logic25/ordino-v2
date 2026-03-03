import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InvoiceTable } from "./InvoiceTable";
import { InvoiceDetailSheet } from "./InvoiceDetailSheet";
import { useInvoices, type InvoiceWithRelations } from "@/hooks/useInvoices";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { CalendarIcon, Search, DollarSign, CreditCard, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

export function PaidView() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [search, setSearch] = useState("");
  const [detailInvoice, setDetailInvoice] = useState<InvoiceWithRelations | null>(null);

  const { data: allInvoices = [], isLoading } = useInvoices("paid");

  const filtered = useMemo(() => {
    let result = allInvoices.filter((inv) => {
      const paidDate = inv.paid_at ? new Date(inv.paid_at) : new Date(inv.updated_at);
      return isWithinInterval(paidDate, { start: dateRange.from, end: dateRange.to });
    });
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.invoice_number?.toLowerCase().includes(q) ||
          inv.clients?.name?.toLowerCase().includes(q) ||
          inv.projects?.name?.toLowerCase().includes(q) ||
          inv.projects?.project_number?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allInvoices, dateRange, search]);

  const thisMonthTotal = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    return allInvoices
      .filter((inv) => {
        const d = inv.paid_at ? new Date(inv.paid_at) : new Date(inv.updated_at);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      })
      .reduce((s, inv) => s + Number(inv.payment_amount || inv.total_due), 0);
  }, [allInvoices]);

  const thisWeekTotal = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    return allInvoices
      .filter((inv) => {
        const d = inv.paid_at ? new Date(inv.paid_at) : new Date(inv.updated_at);
        return isWithinInterval(d, { start: weekStart, end: weekEnd });
      })
      .reduce((s, inv) => s + Number(inv.payment_amount || inv.total_due), 0);
  }, [allInvoices]);

  const rangeTotal = useMemo(() => {
    return filtered.reduce((s, inv) => s + Number(inv.payment_amount || inv.total_due), 0);
  }, [filtered]);

  const methodBreakdown = useMemo(() => {
    const methods: Record<string, { count: number; total: number }> = {};
    filtered.forEach((inv) => {
      const m = inv.payment_method || "Unknown";
      if (!methods[m]) methods[m] = { count: 0, total: 0 };
      methods[m].count++;
      methods[m].total += Number(inv.payment_amount || inv.total_due);
    });
    return methods;
  }, [filtered]);

  return (
    <div className="space-y-4 py-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <CalendarIcon className="h-3.5 w-3.5 mr-2" />
              {format(dateRange.from, "MMM d")} – {format(dateRange.to, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                if (range?.from && range?.to) setDateRange({ from: range.from, to: range.to });
                else if (range?.from) setDateRange({ from: range.from, to: range.from });
              }}
              className={cn("p-3 pointer-events-auto")}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search paid invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}
        >
          This Month
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              Selected Range
            </div>
            <p className="text-xl font-bold font-mono" data-clarity-mask="true">
              ${rangeTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground">{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Receipt className="h-3.5 w-3.5" />
              This Month
            </div>
            <p className="text-xl font-bold font-mono" data-clarity-mask="true">
              ${thisMonthTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Receipt className="h-3.5 w-3.5" />
              This Week
            </div>
            <p className="text-xl font-bold font-mono" data-clarity-mask="true">
              ${thisWeekTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <CreditCard className="h-3.5 w-3.5" />
              By Method
            </div>
            <div className="space-y-0.5">
              {Object.entries(methodBreakdown).map(([method, info]) => (
                <div key={method} className="flex items-center justify-between text-xs">
                  <span className="capitalize text-muted-foreground">{method}</span>
                  <span className="font-mono font-medium" data-clarity-mask="true">
                    ${info.total.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({info.count})
                  </span>
                </div>
              ))}
              {Object.keys(methodBreakdown).length === 0 && (
                <span className="text-xs text-muted-foreground">No data</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Table */}
      <InvoiceTable
        invoices={filtered}
        isLoading={isLoading}
        onViewInvoice={(inv) => setDetailInvoice(inv)}
        onSendInvoice={() => {}}
        onDeleteInvoice={() => {}}
        selectedIds={[]}
        onSelectionChange={() => {}}
      />

      <InvoiceDetailSheet
        invoice={detailInvoice}
        open={!!detailInvoice}
        onOpenChange={(open) => !open && setDetailInvoice(null)}
        onSendInvoice={() => {}}
      />
    </div>
  );
}
