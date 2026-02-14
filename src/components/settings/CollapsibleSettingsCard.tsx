import { ReactNode, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSettingsCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  headerAction?: ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function CollapsibleSettingsCard({
  title,
  description,
  icon,
  children,
  headerAction,
  defaultOpen = true,
  isOpen,
  onOpenChange,
  className,
}: CollapsibleSettingsCardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isOpen !== undefined ? isOpen : internalOpen;

  useEffect(() => {
    if (isOpen !== undefined) setInternalOpen(isOpen);
  }, [isOpen]);

  const toggle = () => {
    const next = !open;
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={toggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerAction && (
              <div onClick={(e) => e.stopPropagation()}>
                {headerAction}
              </div>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </div>
        </div>
      </CardHeader>
      <div
        className={cn(
          "grid transition-all duration-200",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <CardContent className="pt-0">
            {children}
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
