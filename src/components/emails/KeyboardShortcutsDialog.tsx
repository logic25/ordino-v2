import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = {
  Navigation: [
    { key: "/", desc: "Focus search" },
    { key: "↑", desc: "Previous email" },
    { key: "↓", desc: "Next email" },
    { key: "⏎", desc: "Open email" },
    { key: "Esc", desc: "Close / deselect" },
  ],
  Actions: [
    { key: "P", desc: "Tag to project" },
    { key: "R", desc: "Reply" },
    { key: "E", desc: "Archive" },
    { key: "?", desc: "Show shortcuts" },
  ],
};

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6 mt-2">
          {Object.entries(shortcuts).map(([section, items]) => (
            <div key={section}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{section}</h3>
              <div className="space-y-2">
                {items.map(({ key, desc }) => (
                  <div key={key} className="flex items-center gap-3">
                    <kbd className="min-w-[28px] text-center px-2 py-1 text-xs font-mono bg-muted border border-border rounded">
                      {key}
                    </kbd>
                    <span className="text-sm text-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
