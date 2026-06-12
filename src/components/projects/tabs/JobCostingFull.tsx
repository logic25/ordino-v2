import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { MockService, MockTimeEntry } from "@/components/projects/projectMockData";

export function JobCostingFull({ services, timeEntries }: { services: MockService[]; timeEntries: MockTimeEntry[] }) {
  const costByService: Record<string, number> = {};
  const hoursByService: Record<string, number> = {};
  timeEntries.forEach(te => {
    const rate = te.hourlyRate || 0;
    costByService[te.service] = (costByService[te.service] || 0) + te.hours * rate;
    hoursByService[te.service] = (hoursByService[te.service] || 0) + te.hours;
  });

  const contractTotal = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const costTotal = Object.values(costByService).reduce((s, v) => s + v, 0);
  const totalHours = timeEntries.reduce((s, t) => s + t.hours, 0);
  const margin = contractTotal > 0 ? ((contractTotal - costTotal) / contractTotal * 100) : 0;

  const stats: { label: string; value: string; tip: string }[] = [
    { label: "Contract Price", value: formatCurrency(contractTotal), tip: "Sum of every service's Price on this project (the agreed contract amount with the client). Updates when services are added, edited, or dropped." },
    { label: "Total Cost", value: formatCurrency(costTotal), tip: "Labor cost computed from logged time entries: Σ(hours × team member's hourly rate). Pulled live from the Time tab — does not include expenses or filing fees." },
    { label: "Gross Profit", value: formatCurrency(contractTotal - costTotal), tip: "Contract Price − Total Cost. Negative means logged labor exceeds the contract amount (often a missing rate, mis-tagged time, or under-priced service)." },
    { label: "Margin", value: `${Math.round(margin)}%`, tip: "Gross Profit ÷ Contract Price. Industry healthy zone for expediting is ~40–60%. <20% = red, >50% = green." },
    { label: "Total Hours", value: `${totalHours.toFixed(1)} hrs`, tip: "All hours logged against any service on this project (from the Time tab). Includes billable and non-billable." },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {stat.label}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground/60 hover:text-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px] text-xs leading-relaxed">{stat.tip}</TooltipContent>
                </Tooltip>
              </div>
              <div className="text-lg sm:text-xl font-semibold mt-1">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      </TooltipProvider>
      {costTotal === 0 && totalHours > 0 && (
        <p className="text-xs text-muted-foreground italic">
          Cost shows $0 because team members don't have hourly rates set. Update rates in Settings → Team to see accurate job costing.
        </p>
      )}

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="min-w-[480px] px-4 sm:px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((svc) => {
                const svcCost = costByService[svc.name] || 0;
                const svcHours = hoursByService[svc.name] || 0;
                const sMargin = svc.totalAmount > 0 ? ((svc.totalAmount - svcCost) / svc.totalAmount * 100) : 0;
                return (
                  <TableRow key={svc.id}>
                    <TableCell className="font-medium">{svc.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(svc.totalAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{svcHours > 0 ? `${svcHours.toFixed(1)}h` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{svcCost > 0 ? formatCurrency(svcCost) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{svcCost > 0 ? formatCurrency(svc.totalAmount - svcCost) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {svcCost > 0 ? (
                        <span className={sMargin > 50 ? "text-emerald-600 dark:text-emerald-400" : sMargin < 20 ? "text-red-600 dark:text-red-400" : ""}>{Math.round(sMargin)}%</span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
