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
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Plus, Wallet, ArrowDownLeft, ArrowUpRight, DollarSign, Loader2, TrendingDown,
} from "lucide-react";

export function RetainersView() {
  const { data: retainers = [], isLoading } = useRetainers();
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects();
  const createRetainer = useCreateRetainer();
  const addFunds = useAddRetainerFunds();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRetainer, setSelectedRetainer] = useState<ClientRetainer | null>(null);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [addFundsRetainerId, setAddFundsRetainerId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Create form
  const [newClientId, setNewClientId] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("check");
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Add funds form
  const [fundsAmount, setFundsAmount] = useState("");
  const [fundsDescription, setFundsDescription] = useState("");

  const activeRetainers = retainers.filter((r) => r.status === "active");
  const depletedRetainers = retainers.filter((r) => r.status !== "active");
  const totalBalance = activeRetainers.reduce((sum, r) => sum + Number(r.current_balance), 0);

  const openProjects = useMemo(
    () => projects.filter((p) => p.status === "open"),
    [projects]
  );

  const clientProjects = useMemo(
    () => newClientId ? openProjects.filter((p) => p.client_id === newClientId) : openProjects,
    [newClientId, openProjects]
  );

  const handleCreate = async () => {
    if (!newClientId || !newAmount || !newProjectId) return;
    setCreating(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("id, company_id").single();
      if (!profile) throw new Error("No profile");

      const amount = parseFloat(newAmount);
      const project = projects.find((p) => p.id === newProjectId);

      // Create retainer
      const { data: retainer, error: rErr } = await supabase
        .from("client_retainers")
        .insert({
          company_id: profile.company_id,
          client_id: newClientId,
          original_amount: amount,
          current_balance: amount,
          notes: newNotes || null,
          created_by: profile.id,
        })
        .select()
        .single();
      if (rErr) throw rErr;

      // Record deposit transaction
      await supabase.from("retainer_transactions").insert({
        company_id: profile.company_id,
        retainer_id: retainer.id,
        type: "deposit",
        amount,
        balance_after: amount,
        description: `Deposit - ${project?.name || "Project"}`,
        performed_by: profile.id,
      });

      // Create paid invoice
      const { data: invoice } = await supabase
        .from("invoices")
        .insert({
          company_id: profile.company_id,
          project_id: newProjectId,
          client_id: newClientId,
          invoice_number: "",
          line_items: [{ description: `Deposit - ${project?.name || "Project"}`, quantity: 1, rate: amount, amount }],
          subtotal: amount,
          retainer_applied: 0,
          fees: {},
          total_due: amount,
          status: "paid",
          payment_terms: "Due on Receipt",
          payment_amount: amount,
          payment_method: newPaymentMethod,
          paid_at: new Date().toISOString(),
          created_by: profile.id,
        })
        .select("invoice_number")
        .single();

      toast({
        title: "Deposit created",
        description: invoice?.invoice_number ? `Invoice ${invoice.invoice_number} created` : undefined,
      });
      setCreateOpen(false);
      setNewClientId("");
      setNewProjectId("");
      setNewAmount("");
      setNewNotes("");
      setNewPaymentMethod("check");
      // Invalidate queries
      createRetainer.reset();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
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
      toast({ title: "Funds added to deposit" });
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
              <p className="text-lg font-bold font-mono" data-clarity-mask="true">
                ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {activeRetainers.length} active deposit{activeRetainers.length !== 1 ? "s" : ""}
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Deposit
        </Button>
      </div>

      {/* Active Deposits */}
      {activeRetainers.length === 0 && depletedRetainers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No deposits yet</p>
          <p className="text-xs mt-1">Create a deposit when a client pays upfront</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeRetainers.map((r) => (
            <DepositCard
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
                <DepositCard
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
            <DialogTitle>New Deposit</DialogTitle>
            <DialogDescription>Record a deposit payment from a client</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={newClientId} onValueChange={(v) => { setNewClientId(v); setNewProjectId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {clientProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.project_number || "—"} – {p.name || "Untitled"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <Label>Payment Method</Label>
                <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="card">Credit Card</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="e.g. Deposit for expediting services"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newClientId || !newProjectId || !newAmount || creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Funds Dialog */}
      <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Funds</DialogTitle>
            <DialogDescription>Record an additional deposit payment</DialogDescription>
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
                placeholder="Additional deposit payment"
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

      {/* Deposit Detail Sheet */}
      <DepositDetailSheet
        retainer={selectedRetainer}
        open={!!selectedRetainer}
        onOpenChange={(open) => !open && setSelectedRetainer(null)}
      />
    </div>
  );
}

function DepositCard({
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
            <p className="text-sm font-medium" data-clarity-mask="true">{retainer.clients?.name || "Unknown"}</p>
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
            <p className="text-sm font-bold font-mono" data-clarity-mask="true">
              ${Number(retainer.current_balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground" data-clarity-mask="true">
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

function DepositDetailSheet({
  retainer,
  open,
  onOpenChange,
}: {
  retainer: ClientRetainer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: transactions = [], isLoading } = useRetainerTransactions(retainer?.id);

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
            {retainer.clients?.name || "Deposit"}
          </SheetTitle>
          <SheetDescription>Deposit transaction history</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Balance summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className="text-xl font-bold font-mono text-primary" data-clarity-mask="true">
                ${Number(retainer.current_balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Original Deposit</p>
              <p className="text-xl font-bold font-mono" data-clarity-mask="true">
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
                        <p className={`text-sm font-mono font-medium ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`} data-clarity-mask="true">
                          {isPositive ? "+" : "-"}${Math.abs(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono" data-clarity-mask="true">
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
