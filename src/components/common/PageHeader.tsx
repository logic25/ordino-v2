import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

// Beacon-style page header: amber icon chip + mono title + subtitle, with an
// optional right-aligned action slot (date range, Refresh, primary CTA, …).
// The signature look that makes a page read as "designed" — reuse on every page.
export function PageHeader({
  icon: Icon, title, subtitle, actions,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-mono text-xl font-semibold tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
