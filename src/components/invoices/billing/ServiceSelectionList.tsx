import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Percent, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectedService {
  serviceId: string;
  name: string;
  contractAmount: number;
  previouslyBilled: number;
  remaining: number;
  billingMode: "amount" | "percent";
  inputValue: number;
  billedAmount: number;
}

export interface BillingHistoryEntry {
  amount: number;
  billingMethod: string;
  billingValue?: number;
  date: string;
  createdBy: string | null;
  billedToContactId: string | null;
}

interface ProjectService {
  id: string;
  name: string;
  description: string | null;
  total_amount: number | null;
  fixed_price: number | null;
  billing_type: string | null;
  status: string | null;
}

interface ServiceSelectionListProps {
  projectServices: ProjectService[];
  selectedServices: SelectedService[];
  previouslyBilled: Record<string, number>;
  billingHistory: Record<string, BillingHistoryEntry[]>;
  onToggleService: (svc: ProjectService) => void;
  onUpdateService: (serviceId: string, field: "billingMode" | "inputValue", value: any) => void;
  onBillAgain: (svc: ProjectService, entry: BillingHistoryEntry) => void;
}

export function ServiceSelectionList({
  projectServices, selectedServices, previouslyBilled, billingHistory,
  onToggleService, onUpdateService, onBillAgain,
}: ServiceSelectionListProps) {
  return (
    <div className="space-y-3">
      <Label>Select Services to Bill</Label>
      <div className="space-y-2">
        {projectServices.filter((svc) => {
          const contractAmt = svc.total_amount || svc.fixed_price || 0;
          const prevBilled = previouslyBilled[svc.name] || 0;
          const remaining = Math.max(0, contractAmt - prevBilled);
          return !(contractAmt > 0 && remaining <= 0);
        }).map((svc) => {
          const selected = selectedServices.find((s) => s.serviceId === svc.id);
          const contractAmt = svc.total_amount || svc.fixed_price || 0;
          const prevBilled = previouslyBilled[svc.name] || 0;
          const remaining = Math.max(0, contractAmt - prevBilled);

          return (
            <div
              key={svc.id}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                selected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
              )}
            >
              <div className="flex items-center gap-3">
                <Checkbox checked={!!selected} onCheckedChange={() => onToggleService(svc)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{svc.name}</span>
                    {svc.status && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{svc.status.replace(/_/g, " ")}</Badge>
                    )}
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span>Contract: ${contractAmt.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    {prevBilled > 0 && <span>Billed: ${prevBilled.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>}
                    <span className="text-foreground font-medium">Remaining: ${remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {(billingHistory[svc.name] || []).length > 0 && !selected && (
                <BillingHistorySection
                  history={billingHistory[svc.name]}
                  onBillAgain={(entry) => onBillAgain(svc, entry)}
                  fullyBilled={false}
                />
              )}

              {selected && (
                <div className="mt-3 ml-8 flex items-center gap-2">
                  <div className="flex rounded-md border overflow-hidden shrink-0">
                    <button type="button" onClick={() => onUpdateService(svc.id, "billingMode", "amount")}
                      className={cn("px-2 py-1 text-xs transition-colors", selected.billingMode === "amount" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                      <DollarSign className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => {
                      onUpdateService(svc.id, "billingMode", "percent");
                      if (selected.billingMode !== "percent") onUpdateService(svc.id, "inputValue", 100);
                    }}
                      className={cn("px-2 py-1 text-xs transition-colors", selected.billingMode === "percent" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                      <Percent className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="relative w-32">
                    {selected.billingMode === "amount" && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>}
                    <Input
                      type="number" min={0}
                      max={selected.billingMode === "percent" ? 100 : selected.remaining}
                      step={selected.billingMode === "percent" ? 1 : 0.01}
                      value={selected.inputValue}
                      onChange={(e) => onUpdateService(svc.id, "inputValue", Number(e.target.value))}
                      className={cn("h-8 text-sm tabular-nums", selected.billingMode === "amount" ? "pl-6" : "")}
                    />
                    {selected.billingMode === "percent" && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>}
                  </div>
                  <div className="ml-auto text-right">
                    <span className="text-sm font-medium tabular-nums">${selected.billedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    {selected.billedAmount < selected.remaining && selected.contractAmount > 0 && (
                      <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                        Bal: ${(selected.remaining - selected.billedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        {" "}({Math.round(((selected.remaining - selected.billedAmount) / selected.contractAmount) * 100)}%)
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BillingHistorySection({
  history, onBillAgain, fullyBilled,
}: { history: BillingHistoryEntry[]; onBillAgain: (entry: BillingHistoryEntry) => void; fullyBilled: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (history.length === 0) return null;

  return (
    <div className="mt-2 ml-8">
      <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {history.length} previous billing{history.length > 1 ? "s" : ""}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1 text-xs text-muted-foreground border-l-2 border-muted pl-3">
          {history.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="tabular-nums font-medium text-foreground">${entry.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              {entry.billingMethod === "percentage" && entry.billingValue && <span>({entry.billingValue}%)</span>}
              <span>on {new Date(entry.date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}</span>
              {!fullyBilled && (
                <Button type="button" variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5" onClick={() => onBillAgain(entry)}>
                  <RotateCcw className="h-2.5 w-2.5" /> Bill Again
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
