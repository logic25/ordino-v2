import type { InvoiceWithRelations } from "@/hooks/useInvoices";

interface TotalsSectionProps {
  invoice: InvoiceWithRelations;
}

export function TotalsSection({ invoice }: TotalsSectionProps) {
  return (
    <section className="space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="tabular-nums" data-clarity-mask="true">
          ${Number(invoice.subtotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>
      {Number(invoice.retainer_applied) > 0 && (
        <div className="flex justify-between text-success">
          <span>Deposit Applied</span>
          <span className="tabular-nums" data-clarity-mask="true">
            -${Number(invoice.retainer_applied).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
      <div className="flex justify-between text-base font-bold pt-1 border-t">
        <span>Total Due</span>
        <span className="tabular-nums" data-clarity-mask="true">
          ${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </section>
  );
}
