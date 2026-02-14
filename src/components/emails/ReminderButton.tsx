import { useState } from "react";
import { addDays, addHours, format } from "date-fns";
import { Bell, BellOff, Clock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useEmailReminders,
  useCreateReminder,
  useCancelReminder,
  type EmailReminder,
} from "@/hooks/useEmailReminders";
import { useToast } from "@/hooks/use-toast";

interface ReminderButtonProps {
  emailId: string;
  compact?: boolean;
}

const QUICK_OPTIONS = [
  { label: "In 1 hour", getDate: () => addHours(new Date(), 1) },
  { label: "Tomorrow", getDate: () => addDays(new Date(), 1) },
  { label: "In 3 days", getDate: () => addDays(new Date(), 3) },
  { label: "In 1 week", getDate: () => addDays(new Date(), 7) },
];

export function ReminderButton({ emailId, compact }: ReminderButtonProps) {
  const [open, setOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const { data: reminders = [] } = useEmailReminders(emailId);
  const createReminder = useCreateReminder();
  const cancelReminder = useCancelReminder();
  const { toast } = useToast();

  const hasReminder = reminders.length > 0;

  const handleCreate = async (date: Date, condition = "no_reply") => {
    try {
      await createReminder.mutateAsync({ emailId, remindAt: date, condition });
      toast({
        title: "Reminder set",
        description: `Remind if no reply by ${format(date, "MMM d, h:mm a")}`,
      });
      setOpen(false);
      setShowCalendar(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = async (reminder: EmailReminder) => {
    try {
      await cancelReminder.mutateAsync(reminder.id);
      toast({ title: "Reminder cancelled" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(hasReminder && "text-warning")}
        >
          {hasReminder ? (
            <Bell className="h-4 w-4 mr-1.5 fill-current" />
          ) : (
            <Bell className="h-4 w-4 mr-1.5" />
          )}
          {!compact && (hasReminder ? "Reminder" : "Remind")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        {/* Active reminders */}
        {reminders.length > 0 && (
          <div className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Active Reminders</p>
            {reminders.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                  <span className="truncate">
                    {format(new Date(r.remind_at), "MMM d, h:mm a")}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5">
                    {r.condition === "no_reply" ? "No reply" : "Date"}
                  </Badge>
                </div>
                <button
                  onClick={() => handleCancel(r)}
                  className="text-muted-foreground hover:text-destructive"
                  disabled={cancelReminder.isPending}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Separator />
          </div>
        )}

        {/* Quick options */}
        <div className="p-2">
          <p className="text-xs font-medium text-muted-foreground px-2 pb-2">
            Remind if no reply
          </p>
          {QUICK_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => handleCreate(opt.getDate())}
              disabled={createReminder.isPending}
              className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors flex items-center justify-between"
            >
              <span>{opt.label}</span>
              <span className="text-xs text-muted-foreground">
                {format(opt.getDate(), "MMM d")}
              </span>
            </button>
          ))}
          <Separator className="my-1" />
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
          >
            Custom date...
          </button>
        </div>

        {showCalendar && (
          <div className="p-2 border-t">
            <Calendar
              mode="single"
              selected={undefined}
              onSelect={(date) => {
                if (date) {
                  // Set reminder for 9 AM on the selected date
                  const remindDate = new Date(date);
                  remindDate.setHours(9, 0, 0, 0);
                  if (remindDate <= new Date()) {
                    remindDate.setHours(new Date().getHours() + 1);
                  }
                  handleCreate(remindDate);
                }
              }}
              disabled={(date) => date < new Date()}
              className="rounded-md"
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
