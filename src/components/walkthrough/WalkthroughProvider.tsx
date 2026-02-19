import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

export interface WalkthroughStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

export interface Walkthrough {
  id: string;
  name: string;
  steps: WalkthroughStep[];
  /** Optional route to navigate to before starting the walkthrough */
  startPath?: string;
}

interface WalkthroughContextValue {
  startWalkthrough: (walkthrough: Walkthrough) => void;
  isActive: boolean;
}

const WalkthroughContext = createContext<WalkthroughContextValue>({
  startWalkthrough: () => {},
  isActive: false,
});

export const useWalkthrough = () => useContext(WalkthroughContext);

const TOOLTIP_W = 300;
const TOOLTIP_H = 200;
const PAD = 16;
const HIGHLIGHT_PAD = 8;

function computeTooltipPos(rect: DOMRect, placement: string) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;

  switch (placement) {
    case "bottom":
      top = rect.bottom + PAD;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      break;
    case "top":
      top = rect.top - PAD - TOOLTIP_H;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      break;
    case "right":
      top = rect.top + rect.height / 2 - TOOLTIP_H / 2;
      left = rect.right + PAD;
      break;
    case "left":
      top = rect.top + rect.height / 2 - TOOLTIP_H / 2;
      left = rect.left - PAD - TOOLTIP_W;
      break;
    default:
      top = rect.bottom + PAD;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  }

  // Clamp within viewport
  left = Math.max(8, Math.min(left, vw - TOOLTIP_W - 8));
  top = Math.max(8, Math.min(top, vh - TOOLTIP_H - 8));

  return { top, left };
}

export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const [activeWalkthrough, setActiveWalkthrough] = useState<Walkthrough | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [resolvedPlacement, setResolvedPlacement] = useState("bottom");

  const applyStep = useCallback((step: WalkthroughStep) => {
    const el = document.querySelector(step.target);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const placement = step.placement || "bottom";
    setHighlightRect(rect);
    setTooltipPos(computeTooltipPos(rect, placement));
    setResolvedPlacement(placement);
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    return true;
  }, []);

  // Poll for element when step changes
  useEffect(() => {
    if (!activeWalkthrough) return;
    const step = activeWalkthrough.steps[currentStep];
    if (!step) return;

    let cancelled = false;
    let attempts = 0;
    const MAX = 20;

    const tryFind = () => {
      if (cancelled) return;
      const found = applyStep(step);
      if (!found && attempts < MAX) {
        attempts++;
        setTimeout(tryFind, 200);
      } else if (!found) {
        setHighlightRect(null);
        setTooltipPos({
          top: window.innerHeight / 2 - TOOLTIP_H / 2,
          left: window.innerWidth / 2 - TOOLTIP_W / 2,
        });
        setResolvedPlacement("bottom");
      }
    };

    const t = setTimeout(tryFind, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [activeWalkthrough, currentStep, applyStep]);

  // Reposition on resize/scroll
  useEffect(() => {
    if (!activeWalkthrough) return;
    const step = activeWalkthrough.steps[currentStep];
    if (!step) return;
    const handler = () => applyStep(step);
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [activeWalkthrough, currentStep, applyStep]);

  const startWalkthrough = useCallback((wt: Walkthrough) => {
    setActiveWalkthrough(wt);
    setCurrentStep(0);
    setHighlightRect(null);
  }, []);

  const close = useCallback(() => {
    setActiveWalkthrough(null);
    setCurrentStep(0);
    setHighlightRect(null);
  }, []);

  const next = useCallback(() => {
    if (!activeWalkthrough) return;
    if (currentStep < activeWalkthrough.steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      close();
    }
  }, [activeWalkthrough, currentStep, close]);

  const prev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const step = activeWalkthrough?.steps[currentStep];
  const isLast = activeWalkthrough ? currentStep === activeWalkthrough.steps.length - 1 : false;
  const total = activeWalkthrough?.steps.length ?? 0;

  // Compute 4 overlay rects to create a "hole" around the highlighted element
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

  const hl = highlightRect
    ? {
        top: Math.max(0, highlightRect.top - HIGHLIGHT_PAD),
        left: Math.max(0, highlightRect.left - HIGHLIGHT_PAD),
        right: Math.min(vw, highlightRect.right + HIGHLIGHT_PAD),
        bottom: Math.min(vh, highlightRect.bottom + HIGHLIGHT_PAD),
      }
    : null;

  // Arrow direction (points FROM tooltip TOWARD highlighted element)
  const arrowStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      width: 0,
      height: 0,
    };
    switch (resolvedPlacement) {
      case "bottom": // tooltip is below target → arrow points up
        return { ...base, top: -8, left: "50%", transform: "translateX(-50%)", borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: "8px solid hsl(var(--border))" };
      case "top": // tooltip is above target → arrow points down
        return { ...base, bottom: -8, left: "50%", transform: "translateX(-50%)", borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "8px solid hsl(var(--border))" };
      case "right": // tooltip is right of target → arrow points left
        return { ...base, left: -8, top: "50%", transform: "translateY(-50%)", borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderRight: "8px solid hsl(var(--border))" };
      case "left": // tooltip is left of target → arrow points right
        return { ...base, right: -8, top: "50%", transform: "translateY(-50%)", borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderLeft: "8px solid hsl(var(--border))" };
      default:
        return base;
    }
  };

  return (
    <WalkthroughContext.Provider value={{ startWalkthrough, isActive: !!activeWalkthrough }}>
      {children}
      {activeWalkthrough && step &&
        createPortal(
          <>
            {/* 4-panel overlay creating a spotlight cutout — much more reliable than SVG mask */}
            {hl ? (
              <>
                {/* Top panel */}
                <div
                  className="fixed bg-black/60 pointer-events-none"
                  style={{ zIndex: 9998, top: 0, left: 0, right: 0, height: hl.top }}
                />
                {/* Left panel */}
                <div
                  className="fixed bg-black/60 pointer-events-none"
                  style={{ zIndex: 9998, top: hl.top, left: 0, width: hl.left, bottom: vh - hl.bottom }}
                />
                {/* Right panel */}
                <div
                  className="fixed bg-black/60 pointer-events-none"
                  style={{ zIndex: 9998, top: hl.top, left: hl.right, right: 0, bottom: vh - hl.bottom }}
                />
                {/* Bottom panel */}
                <div
                  className="fixed bg-black/60 pointer-events-none"
                  style={{ zIndex: 9998, top: hl.bottom, left: 0, right: 0, bottom: 0 }}
                />
                {/* Highlight ring */}
                <div
                  className="fixed pointer-events-none rounded-lg"
                  style={{
                    zIndex: 9999,
                    top: hl.top,
                    left: hl.left,
                    width: hl.right - hl.left,
                    height: hl.bottom - hl.top,
                    boxShadow: "0 0 0 3px hsl(var(--primary)), 0 0 20px hsl(var(--primary) / 0.5)",
                  }}
                />
              </>
            ) : (
              /* No target found — full overlay */
              <div
                className="fixed inset-0 bg-black/60 pointer-events-none"
                style={{ zIndex: 9998 }}
              />
            )}

            {/* Click-to-close backdrop (behind tooltip) */}
            <div
              className="fixed inset-0"
              style={{ zIndex: 10000 }}
              onClick={close}
            />

            {/* Tooltip */}
            <div
              className="fixed bg-card border border-border rounded-xl shadow-2xl p-4 space-y-3"
              style={{
                zIndex: 10001,
                top: tooltipPos.top,
                left: tooltipPos.left,
                width: TOOLTIP_W,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Arrow */}
              {highlightRect && <div style={arrowStyle()} />}

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">
                    Step {currentStep + 1} of {total}
                  </p>
                  <h4 className="font-semibold text-foreground text-sm mt-0.5 leading-snug">
                    {step.title}
                  </h4>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mt-1 -mr-1" onClick={close}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.content}</p>
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prev}
                  disabled={currentStep === 0}
                  className="text-xs"
                >
                  <ChevronLeft className="h-3 w-3 mr-1" /> Back
                </Button>
                <Button size="sm" onClick={next} className="text-xs">
                  {isLast ? "Finish" : "Next"}
                  {!isLast && <ChevronRight className="h-3 w-3 ml-1" />}
                </Button>
              </div>
            </div>
          </>,
          document.body
        )}
    </WalkthroughContext.Provider>
  );
}
