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

const TOOLTIP_W = 320;
const TOOLTIP_H = 180;
const PAD = 14;

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

  const applyStep = useCallback((step: WalkthroughStep) => {
    const el = document.querySelector(step.target);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    setHighlightRect(rect);
    setTooltipPos(computeTooltipPos(rect, step.placement || "bottom"));
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
    const MAX = 20; // 4 seconds

    const tryFind = () => {
      if (cancelled) return;
      const found = applyStep(step);
      if (!found && attempts < MAX) {
        attempts++;
        setTimeout(tryFind, 200);
      } else if (!found) {
        // Fallback: center screen
        setHighlightRect(null);
        setTooltipPos({
          top: window.innerHeight / 2 - TOOLTIP_H / 2,
          left: window.innerWidth / 2 - TOOLTIP_W / 2,
        });
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

  return (
    <WalkthroughContext.Provider value={{ startWalkthrough, isActive: !!activeWalkthrough }}>
      {children}
      {activeWalkthrough && step &&
        createPortal(
          <>
            {/* Dark overlay with SVG cutout */}
            <svg
              className="fixed inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 9998 }}
            >
              <defs>
                <mask id="wt-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {highlightRect && (
                    <rect
                      x={highlightRect.left - 8}
                      y={highlightRect.top - 8}
                      width={highlightRect.width + 16}
                      height={highlightRect.height + 16}
                      rx={8}
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.6)"
                mask="url(#wt-mask)"
              />
            </svg>

            {/* Click-to-close overlay (below tooltip) */}
            <div
              className="fixed inset-0"
              style={{ zIndex: 9999 }}
              onClick={close}
            />

            {/* Highlight ring */}
            {highlightRect && (
              <div
                className="fixed pointer-events-none rounded-lg border-2 border-primary animate-pulse"
                style={{
                  zIndex: 10000,
                  top: highlightRect.top - 8,
                  left: highlightRect.left - 8,
                  width: highlightRect.width + 16,
                  height: highlightRect.height + 16,
                }}
              />
            )}

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
