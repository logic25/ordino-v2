import { useRef, useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RotateCcw, PenLine, Send } from "lucide-react";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { ProposalWithRelations } from "@/hooks/useProposals";

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSign: (signatureData: string, assignedPmId: string) => Promise<void>;
  proposal: ProposalWithRelations | null;
  isLoading?: boolean;
}

export function SignatureDialog({
  open,
  onOpenChange,
  onSign,
  proposal,
  isLoading,
}: SignatureDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [assignedPmId, setAssignedPmId] = useState<string>("");
  const [saveSignature, setSaveSignature] = useState(true);
  const [savedSignatureData, setSavedSignatureData] = useState<string | null>(null);
  const { data: profiles = [] } = useAssignableProfiles();
  const { profile } = useAuth();

  // Load saved signature from profile
  useEffect(() => {
    if (open && profile) {
      const sig = (profile as any).signature_data;
      setSavedSignatureData(sig || null);
    }
  }, [open, profile]);

  useEffect(() => {
    if (open && proposal?.assigned_pm_id) {
      setAssignedPmId(proposal.assigned_pm_id);
    }
  }, [open, proposal]);

  // Initialize canvas and optionally draw saved signature
  useEffect(() => {
    if (open && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }

      // If saved signature exists and user hasn't drawn yet, load it
      if (savedSignatureData && !hasDrawn) {
        const img = new Image();
        img.onload = () => {
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setHasSignature(true);
          }
        };
        img.src = savedSignatureData;
      }
    }
  }, [open, savedSignatureData]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
      setHasDrawn(true);
    }
  };

  const handleSign = async () => {
    if (!canvasRef.current || !hasSignature || !assignedPmId) return;
    const signatureData = canvasRef.current.toDataURL("image/png");

    // Save signature to profile if checked
    if (saveSignature && profile) {
      supabase
        .from("profiles")
        .update({ signature_data: signatureData } as any)
        .eq("id", profile.id)
        .then(() => {});
    }

    await onSign(signatureData, assignedPmId);
    setHasDrawn(false);
    setAssignedPmId("");
  };

  const fmt = (v: number | null) => {
    if (!v) return "$0";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Sign & Send Proposal
          </DialogTitle>
          <DialogDescription>
            Sign this proposal, then it will be emailed to the client for their review and counter-signature.
          </DialogDescription>
        </DialogHeader>

        {proposal && (
          <div className="space-y-4">
            {/* Proposal Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Proposal</span>
                <span className="font-mono text-sm">{proposal.proposal_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Property</span>
                <span className="text-sm">{proposal.properties?.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Client</span>
                <span className="text-sm">{proposal.client_name || "-"}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Total</span>
                <span className="font-bold">{fmt(Number(proposal.total_amount))}</span>
              </div>
            </div>

            {/* Assign PM */}
            <div className="space-y-2">
              <Label htmlFor="pm">Assign Project Manager *</Label>
              <Select value={assignedPmId} onValueChange={setAssignedPmId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select PM to assign..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Signature Pad */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Your Signature *</Label>
                <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden bg-white">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="w-full cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              {savedSignatureData && !hasDrawn && (
                <p className="text-xs text-emerald-600">✓ Using your saved signature</p>
              )}
              {!savedSignatureData && (
                <p className="text-xs text-muted-foreground">
                  Draw your signature above using your mouse or touch screen
                </p>
              )}

              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="save-sig"
                  checked={saveSignature}
                  onCheckedChange={(v) => setSaveSignature(!!v)}
                />
                <label htmlFor="save-sig" className="text-xs text-muted-foreground cursor-pointer">
                  Save signature for future proposals
                </label>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSign}
            disabled={!hasSignature || !assignedPmId || isLoading}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Sign & Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
