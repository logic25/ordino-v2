import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: "Contract Price", value: formatCurrency(contractTotal) },
          { label: "Total Cost", value: formatCurrency(costTotal) },
          { label: "Gross Profit", value: formatCurrency(contractTotal - costTotal) },
          { label: "Margin", value: `${Math.round(margin)}%` },
          { label: "Total Hours", value: `${totalHours.toFixed(1)} hrs` },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              <div className="text-lg sm:text-xl font-semibold mt-1">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
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
