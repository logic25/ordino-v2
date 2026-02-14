import { useState } from "react";
import { format, addDays, nextMonday, setHours, setMinutes, setSeconds, isMonday, startOfDay } from "date-fns";
import { Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ScheduleSendDropdownProps {
  onSchedule: (date: Date) => void;
  disabled?: boolean;
}

function getQuickOptions() {
  const now = new Date();
  const tomorrow9am = setSeconds(setMinutes(setHours(addDays(startOfDay(now), 1), 9), 0), 0);
  const monday9am = isMonday(now)
    ? setSeconds(setMinutes(setHours(addDays(startOfDay(now), 7), 9), 0), 0)
    : setSeconds(setMinutes(setHours(nextMonday(now), 9), 0), 0);

  return [
    {
      label: `Tomorrow 9:00 AM`,
      sublabel: format(tomorrow9am, "EEE, MMM d"),
      date: tomorrow9am,
    },
    {
      label: `Monday 9:00 AM`,
      sublabel: format(monday9am, "EEE, MMM d"),
      date: monday9am,
    },
  ];
}

export function ScheduleSendDropdown({ onSchedule, disabled }: ScheduleSendDropdownProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("09:00");

  const quickOptions = getQuickOptions();

  const handleCustomSchedule = () => {
    if (!selectedDate) return;
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const scheduledDate = setSeconds(setMinutes(setHours(selectedDate, hours), minutes), 0);
    onSchedule(scheduledDate);
    setCustomOpen(false);
    setSelectedDate(undefined);
    setSelectedTime("09:00");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled}>
            <Clock className="h-4 w-4 mr-1.5" />
            Send Later
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {quickOptions.map((opt) => (
            <DropdownMenuItem
              key={opt.label}
              onClick={() => onSchedule(opt.date)}
            >
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.sublabel}</p>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCustomOpen(true)}>
            <div>
              <p className="text-sm font-medium">Pick date & time...</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Schedule Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return date < today;
              }}
              className="rounded-md border mx-auto"
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCustomOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCustomSchedule} disabled={!selectedDate}>
                <Clock className="h-4 w-4 mr-1.5" />
                Schedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
