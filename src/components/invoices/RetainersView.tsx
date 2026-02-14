import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  useRetainers, useRetainerTransactions, useCreateRetainer, useAddRetainerFunds,
  type ClientRetainer, type RetainerTransaction,
} from "@/hooks/useRetainers";
import { useClients } from "@/hooks/useClients";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Plus, Wallet, ArrowDownLeft, ArrowUpRight, DollarSign, Loader2, TrendingDown,
} from "lucide-react";

// ── Mock retainer data for demo ──────────────────────────────────
const MOCK_RETAINERS: ClientRetainer[] = [
  {
    id: "mock-ret-1", company_id: "mock", client_id: "c1",
    original_amount: 75000, current_balance: 52340,
    status: "active", notes: "Annual retainer for expediting services — 340 Park Ave", qbo_credit_memo_id: null,
    created_by: null, created_at: "2025-09-15T10:00:00Z", updated_at: "2026-02-01T10:00:00Z",
    clients: { name: "Rudin Management" },
  },
  {
    id: "mock-ret-2", company_id: "mock", client_id: "c2",
    original_amount: 50000, current_balance: 41200,
    status: "active", notes: "Retainer for ongoing DOB filings — Hudson Yards", qbo_credit_memo_id: null,
    created_by: null, created_at: "2025-11-01T10:00:00Z", updated_at: "2026-01-28T10:00:00Z",
    clients: { name: "Related Companies" },
  },
  {
    id: "mock-ret-3", company_id: "mock", client_id: "c3",
    original_amount: 40000, current_balance: 33750,
    status: "active", notes: "Fire alarm & sprinkler filing retainer", qbo_credit_memo_id: null,
    created_by: null, created_at: "2025-10-20T10:00:00Z", updated_at: "2026-02-10T10:00:00Z",
    clients: { name: "Brookfield Properties" },
  },
  {
    id: "mock-ret-4", company_id: "mock", client_id: "c4",
    original_amount: 60000, current_balance: 48500,
    status: "active", notes: "Elevator & escalator filing retainer", qbo_credit_memo_id: null,
    created_by: null, created_at: "2025-08-05T10:00:00Z", updated_at: "2026-01-15T10:00:00Z",
    clients: { name: "SL Green Realty" },
  },
  {
    id: "mock-ret-5", company_id: "mock", client_id: "c5",
    original_amount: 35000, current_balance: 28900,
    status: "active", notes: "Violation resolution & expediting", qbo_credit_memo_id: null,
    created_by: null, created_at: "2025-12-01T10:00:00Z", updated_at: "2026-02-12T10:00:00Z",
    clients: { name: "Vornado Realty Trust" },
  },
  {
    id: "mock-ret-6", company_id: "mock", client_id: "c6",
    original_amount: 25000, current_balance: 0,
    status: "depleted", notes: "One-time retainer for 200 Park Ave reno", qbo_credit_memo_id: null,
    created_by: null, created_at: "2025-03-10T10:00:00Z", updated_at: "2025-11-22T10:00:00Z",
    clients: { name: "Tishman Speyer" },
  },
];

const MOCK_TRANSACTIONS: Record<string, RetainerTransaction[]> = {
  "mock-ret-1": [
    { id: "mt-1a", company_id: "mock", retainer_id: "mock-ret-1", invoice_id: null, type: "deposit", amount: 75000, balance_after: 75000, description: "Initial retainer deposit", performed_by: null, created_at: "2025-09-15T10:00:00Z", invoices: null, profiles: null },
    { id: "mt-1b", company_id: "mock", retainer_id: "mock-ret-1", invoice_id: "i1", type: "draw_down", amount: 8500, balance_after: 66500, description: "Applied to invoice", performed_by: null, created_at: "2025-10-22T10:00:00Z", invoices: { invoice_number: "INV-00087" }, profiles: null },
    { id: "mt-1c", company_id: "mock", retainer_id: "mock-ret-1", invoice_id: "i2", type: "draw_down", amount: 6750, balance_after: 59750, description: "Applied to invoice", performed_by: null, created_at: "2025-12-05T10:00:00Z", invoices: { invoice_number: "INV-00112" }, profiles: null },
    { id: "mt-1d", company_id: "mock", retainer_id: "mock-ret-1", invoice_id: "i3", type: "draw_down", amount: 7410, balance_after: 52340, description: "Applied to invoice", performed_by: null, created_at: "2026-02-01T10:00:00Z", invoices: { invoice_number: "INV-00145" }, profiles: null },
  ],
  "mock-ret-2": [
    { id: "mt-2a", company_id: "mock", retainer_id: "mock-ret-2", invoice_id: null, type: "deposit", amount: 50000, balance_after: 50000, description: "Initial retainer deposit", performed_by: null, created_at: "2025-11-01T10:00:00Z", invoices: null, profiles: null },
    { id: "mt-2b", company_id: "mock", retainer_id: "mock-ret-2", invoice_id: "i4", type: "draw_down", amount: 4300, balance_after: 45700, description: "Applied to invoice", performed_by: null, created_at: "2025-12-15T10:00:00Z", invoices: { invoice_number: "INV-00119" }, profiles: null },
    { id: "mt-2c", company_id: "mock", retainer_id: "mock-ret-2", invoice_id: "i5", type: "draw_down", amount: 4500, balance_after: 41200, description: "Applied to invoice", performed_by: null, created_at: "2026-01-28T10:00:00Z", invoices: { invoice_number: "INV-00138" }, profiles: null },
  ],
};

export function RetainersView() {
  const { data: dbRetainers = [], isLoading } = useRetainers();
  const { data: clients = [] } = useClients();
  const createRetainer = useCreateRetainer();
  const addFunds = useAddRetainerFunds();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRetainer, setSelectedRetainer] = useState<ClientRetainer | null>(null);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [addFundsRetainerId, setAddFundsRetainerId] = useState<string | null>(null);

  // Create form
  const [newClientId, setNewClientId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Add funds form
  const [fundsAmount, setFundsAmount] = useState("");
  const [fundsDescription, setFundsDescription] = useState("");

  // Merge mock + real data
  const retainers = useMemo(() => {
    return [...dbRetainers, ...MOCK_RETAINERS];
  }, [dbRetainers]);

  const activeRetainers = retainers.filter((r) => r.status === "active");
  const depletedRetainers = retainers.filter((r) => r.status !== "active");
  const totalBalance = activeRetainers.reduce((sum, r) => sum + Number(r.current_balance), 0);

  const handleCreate = async () => {
    if (!newClientId || !newAmount) return;
    try {
      await createRetainer.mutateAsync({
        client_id: newClientId,
        original_amount: parseFloat(newAmount),
        notes: newNotes || undefined,
      });
      toast({ title: "Retainer created" });
      setCreateOpen(false);
      setNewClientId("");
      setNewAmount("");
      setNewNotes("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAddFunds = async () => {
    if (!addFundsRetainerId || !fundsAmount) return;
    try {
      await addFunds.mutateAsync({
        retainer_id: addFundsRetainerId,
        amount: parseFloat(fundsAmount),
        description: fundsDescription || undefined,
      });
      toast({ title: "Funds added to retainer" });
      setAddFundsOpen(false);
      setAddFundsRetainerId(null);
      setFundsAmount("");
      setFundsDescription("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Active Balance</p>
              <p className="text-lg font-bold font-mono">
                ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {activeRetainers.length} active retainer{activeRetainers.length !== 1 ? "s" : ""}
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Retainer
        </Button>
      </div>

      {/* Active Retainers */}
      {activeRetainers.length === 0 && depletedRetainers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No retainers yet</p>
          <p className="text-xs mt-1">Create a retainer when a client pays a deposit</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeRetainers.map((r) => (
            <RetainerCard
              key={r.id}
              retainer={r}
              onView={() => setSelectedRetainer(r)}
              onAddFunds={() => {
                setAddFundsRetainerId(r.id);
                setAddFundsOpen(true);
              }}
            />
          ))}
          {depletedRetainers.length > 0 && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Depleted / Closed
              </p>
              {depletedRetainers.map((r) => (
                <RetainerCard
                  key={r.id}
                  retainer={r}
                  onView={() => setSelectedRetainer(r)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Retainer</DialogTitle>
            <DialogDescription>Record a retainer deposit from a client</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={newClientId} onValueChange={setNewClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deposit Amount ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="5,000.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="e.g. Retainer for ongoing expediting services"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newClientId || !newAmount || createRetainer.isPending}>
              {createRetainer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Retainer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Funds Dialog */}
      <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Funds</DialogTitle>
            <DialogDescription>Record an additional deposit to this retainer</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={fundsAmount}
                onChange={(e) => setFundsAmount(e.target.value)}
                placeholder="2,500.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={fundsDescription}
                onChange={(e) => setFundsDescription(e.target.value)}
                placeholder="Additional retainer deposit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFundsOpen(false)}>Cancel</Button>
            <Button onClick={handleAddFunds} disabled={!fundsAmount || addFunds.isPending}>
              {addFunds.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Funds
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retainer Detail Sheet */}
      <RetainerDetailSheet
        retainer={selectedRetainer}
        open={!!selectedRetainer}
        onOpenChange={(open) => !open && setSelectedRetainer(null)}
      />
    </div>
  );
}

function RetainerCard({
  retainer,
  onView,
  onAddFunds,
}: {
  retainer: ClientRetainer;
  onView: () => void;
  onAddFunds?: () => void;
}) {
  const pctUsed =
    retainer.original_amount > 0
      ? ((retainer.original_amount - retainer.current_balance) / retainer.original_amount) * 100
      : 0;

  const statusColor: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    depleted: "bg-muted text-muted-foreground border-muted",
    refunded: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div
      className="rounded-lg border p-4 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onView}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{retainer.clients?.name || "Unknown"}</p>
            <p className="text-xs text-muted-foreground">
              Created {format(new Date(retainer.created_at), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={statusColor[retainer.status] || ""}>
            {retainer.status}
          </Badge>
          <div className="text-right">
            <p className="text-sm font-bold font-mono">
              ${Number(retainer.current_balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground">
              of ${Number(retainer.original_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Usage bar */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.min(100, pctUsed)}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground font-mono w-10 text-right">
          {pctUsed.toFixed(0)}%
        </span>
        {onAddFunds && retainer.status === "active" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onAddFunds();
            }}
          >
            <Plus className="h-3 w-3 mr-1" /> Add Funds
          </Button>
        )}
      </div>

      {retainer.notes && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{retainer.notes}</p>
      )}
    </div>
  );
}

function RetainerDetailSheet({
  retainer,
  open,
  onOpenChange,
}: {
  retainer: ClientRetainer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: dbTransactions = [], isLoading: txLoading } = useRetainerTransactions(
    retainer?.id?.startsWith("mock-") ? undefined : retainer?.id
  );

  // Use mock transactions for mock retainers
  const transactions = retainer?.id?.startsWith("mock-")
    ? (MOCK_TRANSACTIONS[retainer.id] || [])
    : dbTransactions;
  const isLoading = retainer?.id?.startsWith("mock-") ? false : txLoading;

  if (!retainer) return null;

  const typeIcon: Record<string, typeof ArrowDownLeft> = {
    deposit: ArrowDownLeft,
    draw_down: ArrowUpRight,
    refund: ArrowUpRight,
    adjustment: DollarSign,
  };

  const typeColor: Record<string, string> = {
    deposit: "text-emerald-600 dark:text-emerald-400",
    draw_down: "text-destructive",
    refund: "text-amber-600 dark:text-amber-400",
    adjustment: "text-muted-foreground",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {retainer.clients?.name || "Retainer"}
          </SheetTitle>
          <SheetDescription>Retainer transaction history</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Balance summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className="text-xl font-bold font-mono text-primary">
                ${Number(retainer.current_balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Original Deposit</p>
              <p className="text-xl font-bold font-mono">
                ${Number(retainer.original_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <Separator />

          {/* Transaction ledger */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Transactions
            </h4>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => {
                  const Icon = typeIcon[tx.type] || DollarSign;
                  const color = typeColor[tx.type] || "";
                  const isPositive = tx.type === "deposit";
                  return (
                    <div key={tx.id} className="flex items-center gap-3 p-2.5 rounded-md border bg-background">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center bg-muted ${color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium capitalize">
                          {tx.type.replace("_", " ")}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {tx.description}
                          {tx.invoices?.invoice_number && ` • ${tx.invoices.invoice_number}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-mono font-medium ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                          {isPositive ? "+" : "-"}${Math.abs(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Bal: ${Number(tx.balance_after).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
