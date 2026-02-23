import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onClick: () => void;
}

export function AskOrdinoButton({ onClick }: Props) {
  return (
    <Button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 h-12 px-4 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
    >
      <Sparkles className="h-4 w-4" />
      <span className="text-sm font-medium hidden sm:inline">Ask Ordino</span>
    </Button>
  );
}
