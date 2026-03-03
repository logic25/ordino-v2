import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { useUpdateCoSignOff, useDeleteCoSignOff, type CoSignOff } from "@/hooks/useCoSignOffs";
import { useToast } from "@/hooks/use-toast";

interface EditSignOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signOff: CoSignOff | null;
}

export function EditSignOffDialog({ open, onOpenChange, signOff }: EditSignOffDialogProps) {
  const { toast } = useToast();
  const update = useUpdateCoSignOff();
  const remove = useDeleteCoSignOff();

  const [name, setName] = useState("");
  const [status, setStatus] = useState("Pending");
  const [tcoRequired, setTcoRequired] = useState(false);
  const [signOffDate, setSignOffDate] = useState("");
  const [jobNum, setJobNum] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

  useEffect(() => {
    if (signOff && open) {
      setName(signOff.name);
      setStatus(signOff.status);
      setTcoRequired(signOff.tco_required);
      setSignOffDate(signOff.sign_off_date || "");
      setJobNum(signOff.job_num || "");
      setExpirationDate(signOff.expiration_date || "");
    }
  }, [signOff, open]);

  const handleSave = async () => {
    if (!signOff) return;
    try {
      await update.mutateAsync({
        id: signOff.id,
        name,
        status,
        tco_required: tcoRequired,
        sign_off_date: signOffDate || null,
        job_num: jobNum || null,
        expiration_date: expirationDate || null,
      });
      toast({ title: "Sign-off updated" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!signOff) return;
    try {
      await remove.mutateAsync(signOff.id);
      toast({ title: "Sign-off removed" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Sign-Off</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Permit Issued">Permit Issued</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Signed Off">Signed Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Required for TCO</Label>
            <Switch checked={tcoRequired} onCheckedChange={setTcoRequired} />
          </div>
          <div className="space-y-2">
            <Label>Sign-Off Date</Label>
            <Input
              placeholder="MM/DD/YYYY"
              value={signOffDate}
              onChange={(e) => setSignOffDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Job Number</Label>
            <Input
              placeholder="e.g. 401536806"
              value={jobNum}
              onChange={(e) => setJobNum(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Expiration Date</Label>
            <Input
              placeholder="MM/DD/YYYY"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={remove.isPending}>
            {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Remove
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={update.isPending || !name.trim()}>
              {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
