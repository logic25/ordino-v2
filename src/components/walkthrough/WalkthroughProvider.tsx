import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Play } from "lucide-react";

export interface WalkthroughStep {
  /** CSS selector for the target element */
  target: string;
  /** Title shown in the tooltip */
  title: string;
  /** Description text */
  content: string;
  /** Which side to show the tooltip */
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

export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const [activeWalkthrough, setActiveWalkthrough] = useState<Walkthrough | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; placement: string }>({
    top: 0,
    left: 0,
    placement: "bottom",
  });
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const positionTooltip = useCallback((step: WalkthroughStep) => {
    const el = document.querySelector(step.target);
    if (!el) {
      setHighlightRect(null);
      setTooltipPos({ top: window.innerHeight / 2, left: window.innerWidth / 2, placement: "bottom" });
      return;
    }

    const rect = el.getBoundingClientRect();
    setHighlightRect(rect);

    const placement = step.placement || "bottom";
    const pad = 12;
    let top = 0, left = 0;

    switch (placement) {
      case "bottom":
        top = rect.bottom + pad;
        left = rect.left + rect.width / 2;
        break;
      case "top":
        top = rect.top - pad;
        left = rect.left + rect.width / 2;
        break;
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + pad;
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - pad;
        break;
    }

    setTooltipPos({ top, left, placement });

    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useEffect(() => {
    if (!activeWalkthrough) return;
    const step = activeWalkthrough.steps[currentStep];
    if (step) {
      const timer = setTimeout(() => positionTooltip(step), 150);
      return () => clearTimeout(timer);
    }
  }, [activeWalkthrough, currentStep, positionTooltip]);

  // Reposition on resize
  useEffect(() => {
    if (!activeWalkthrough) return;
    const handler = () => positionTooltip(activeWalkthrough.steps[currentStep]);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [activeWalkthrough, currentStep, positionTooltip]);

  const startWalkthrough = useCallback((wt: Walkthrough) => {
    setActiveWalkthrough(wt);
    setCurrentStep(0);
  }, []);

  const close = () => {
    setActiveWalkthrough(null);
    setCurrentStep(0);
    setHighlightRect(null);
  };

  const next = () => {
    if (!activeWalkthrough) return;
    if (currentStep < activeWalkthrough.steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      close();
    }
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const step = activeWalkthrough?.steps[currentStep];
  const isLast = activeWalkthrough ? currentStep === activeWalkthrough.steps.length - 1 : false;

  const tooltipTransform =
    tooltipPos.placement === "bottom"
      ? "translate(-50%, 0)"
      : tooltipPos.placement === "top"
      ? "translate(-50%, -100%)"
      : tooltipPos.placement === "right"
      ? "translate(0, -50%)"
      : "translate(-100%, -50%)";

  return (
    <WalkthroughContext.Provider value={{ startWalkthrough, isActive: !!activeWalkthrough }}>
      {children}
      {activeWalkthrough &&
        step &&
        createPortal(
          <>
            {/* Overlay with cutout */}
            <div className="fixed inset-0 z-[9998]" onClick={close}>
              <svg className="absolute inset-0 w-full h-full">
                <defs>
                  <mask id="walkthrough-mask">
                    <rect x="0" y="0" width="100%" height="100%" fill="white" />
                    {highlightRect && (
                      <rect
                        x={highlightRect.left - 6}
                        y={highlightRect.top - 6}
                        width={highlightRect.width + 12}
                        height={highlightRect.height + 12}
                        rx="8"
                        fill="black"
                      />
                    )}
                  </mask>
                </defs>
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill="rgba(0,0,0,0.55)"
                  mask="url(#walkthrough-mask)"
                />
              </svg>
              {/* Highlight ring */}
              {highlightRect && (
                <div
                  className="absolute border-2 border-accent rounded-lg pointer-events-none animate-pulse"
                  style={{
                    top: highlightRect.top - 6,
                    left: highlightRect.left - 6,
                    width: highlightRect.width + 12,
                    height: highlightRect.height + 12,
                  }}
                />
              )}
            </div>

            {/* Tooltip */}
            <div
              className="fixed z-[9999] w-80 bg-card border border-border rounded-xl shadow-lg p-4 space-y-3"
              style={{ top: tooltipPos.top, left: tooltipPos.left, transform: tooltipTransform }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">
                    Step {currentStep + 1} of {activeWalkthrough.steps.length}
                  </p>
                  <h4 className="font-semibold text-foreground text-sm mt-0.5">{step.title}</h4>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={close}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.content}</p>
              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={prev} disabled={currentStep === 0} className="text-xs">
                  <ChevronLeft className="h-3 w-3 mr-1" /> Back
                </Button>
                <Button size="sm" onClick={next} className="text-xs">
                  {isLast ? "Finish" : "Next"} {!isLast && <ChevronRight className="h-3 w-3 ml-1" />}
                </Button>
              </div>
            </div>
          </>,
          document.body
        )}
    </WalkthroughContext.Provider>
  );
}
