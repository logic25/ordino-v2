import { useRef, useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RotateCcw, PenLine } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import type { ChangeOrder } from "@/hooks/useChangeOrders";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

interface COSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSign: (signatureData: string) => Promise<void>;
  co: ChangeOrder | null;
  isLoading?: boolean;
}

export function COSignatureDialog({
  open,
  onOpenChange,
  onSign,
  co,
  isLoading,
}: COSignatureDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saveSignature, setSaveSignature] = useState(true);
  const [savedSignatureData, setSavedSignatureData] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (open && profile) {
      const sig = (profile as any).signature_data;
      setSavedSignatureData(sig || null);
      setHasDrawn(false);
    }
  }, [open, profile]);

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
      if (savedSignatureData && !hasDrawn && ctx) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = savedSignatureData;
        setHasSignature(true);
      }
    }
  }, [open, savedSignatureData]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(e);
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
    if (!canvasRef.current || !hasSignature) return;
    const signatureData = canvasRef.current.toDataURL("image/png");
    await onSign(signatureData);
    setHasDrawn(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Sign Change Order
          </DialogTitle>
          <DialogDescription>
            Your internal signature advances this CO to "Pending Client" status.
          </DialogDescription>
        </DialogHeader>

        {co && (
          <div className="space-y-4">
            {/* CO Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">CO #</span>
                <span className="font-mono text-sm font-semibold">{co.co_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Title</span>
                <span className="text-sm text-right max-w-[260px] truncate">{co.title}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium text-sm">Amount</span>
                <span className={`font-bold ${co.amount < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                  {co.amount < 0 ? `-${fmt(Math.abs(co.amount))}` : fmt(co.amount)}
                </span>
              </div>
            </div>

            {/* Signature Pad */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Your Signature *</Label>
                <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Clear
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
                  Draw your signature using your mouse or touchscreen
                </p>
              )}
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="save-co-sig"
                  checked={saveSignature}
                  onCheckedChange={(v) => setSaveSignature(!!v)}
                />
                <label htmlFor="save-co-sig" className="text-xs text-muted-foreground cursor-pointer">
                  Save signature for future use
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
            disabled={!hasSignature || isLoading}
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing...</>
            ) : (
              <><PenLine className="mr-2 h-4 w-4" /> Sign Internally</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
