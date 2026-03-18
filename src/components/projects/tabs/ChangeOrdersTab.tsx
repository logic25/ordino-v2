import type { MockChangeOrder } from "../projectMockData";
import { coStatusStyles, formatCurrency } from "../projectMockData";

export function ChangeOrdersTab({ changeOrders }: { changeOrders: MockChangeOrder[] }) {
  if (changeOrders.length === 0) return <p className="text-sm text-muted-foreground italic p-4">No change orders yet.</p>;
  const coTotal = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + co.amount, 0);
  return (
    <div className="p-4 space-y-2">
      {changeOrders.map((co) => {
        const style = coStatusStyles[co.status] || coStatusStyles.draft;
        return (
          <div key={co.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-background border">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium">{co.number}</span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0 text-[10px] font-semibold ${style.className}`}>{style.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{co.description}</p>
            </div>
            <div className="text-right shrink-0 pl-4" data-clarity-mask="true">
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(co.amount)}</span>
              <div className="text-[10px] text-muted-foreground">{co.createdDate}</div>
            </div>
          </div>
        );
      })}
      {coTotal > 0 && (
        <div className="text-xs text-muted-foreground pt-1">
          Approved change orders: <span className="font-semibold text-foreground">{formatCurrency(coTotal)}</span>
        </div>
      )}
    </div>
  );
}
