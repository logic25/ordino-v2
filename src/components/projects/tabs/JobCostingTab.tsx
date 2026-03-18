import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { MockService, MockTimeEntry } from "../projectMockData";
import { formatCurrency } from "../projectMockData";

export function JobCostingTab({ services, timeEntries }: { services: MockService[]; timeEntries: MockTimeEntry[] }) {
  const contractTotal = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const costTotal = services.reduce((s, svc) => s + svc.costAmount, 0);
  const totalHours = timeEntries.reduce((s, t) => s + t.hours, 0);
  const margin = contractTotal > 0 ? ((contractTotal - costTotal) / contractTotal * 100) : 0;

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Contract Price", value: formatCurrency(contractTotal) },
          { label: "Total Cost", value: formatCurrency(costTotal) },
          { label: "Gross Profit", value: formatCurrency(contractTotal - costTotal) },
          { label: "Margin", value: `${Math.round(margin)}%` },
          { label: "Total Hours", value: `${totalHours.toFixed(1)} hrs` },
        ].map((stat) => (
          <div key={stat.label} className="bg-background border rounded-md p-3">
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className="text-lg font-semibold mt-0.5">{stat.value}</div>
          </div>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs uppercase tracking-wider">Service</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Price</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Cost</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((svc) => {
            const sMargin = svc.totalAmount > 0 ? ((svc.totalAmount - svc.costAmount) / svc.totalAmount * 100) : 0;
            return (
              <TableRow key={svc.id} className="hover:bg-muted/20">
                <TableCell className="text-sm font-medium">
                  {svc.changeOrderId && <Badge variant="outline" className="mr-1.5 text-[10px] px-1.5 py-0 font-mono border-amber-500/50 text-amber-600 dark:text-amber-400">CO</Badge>}
                  {svc.name}
                </TableCell>
                <TableCell className="text-sm text-right tabular-nums">{formatCurrency(svc.totalAmount)}</TableCell>
                <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{svc.costAmount > 0 ? formatCurrency(svc.costAmount) : "—"}</TableCell>
                <TableCell className="text-sm text-right tabular-nums">
                  {svc.costAmount > 0 ? (
                    <span className={sMargin > 50 ? "text-emerald-600 dark:text-emerald-400" : sMargin < 20 ? "text-red-600 dark:text-red-400" : ""}>
                      {Math.round(sMargin)}%
                    </span>
                  ) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
