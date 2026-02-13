import { useState } from "react";
import { addDays, nextMonday, setHours, setMinutes, setSeconds } from "date-fns";
import { Clock, CalendarDays } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SnoozeMenuProps {
  onSnooze: (until: Date) => void;
  disabled?: boolean;
}

function at9am(date: Date): Date {
  return setSeconds(setMinutes(setHours(date, 9), 0), 0);
}

export function SnoozeMenu({ onSnooze, disabled }: SnoozeMenuProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");

  const presets = [
    { label: "Tomorrow 9 AM", getDate: () => at9am(addDays(new Date(), 1)) },
    { label: "In 3 Days", getDate: () => at9am(addDays(new Date(), 3)) },
    { label: "Next Monday", getDate: () => at9am(nextMonday(new Date())) },
  ];

  const handleCustom = () => {
    if (!customDate) return;
    const [h, m] = customTime.split(":").map(Number);
    const d = new Date(customDate);
    d.setHours(h, m, 0, 0);
    onSnooze(d);
    setCustomOpen(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <Clock className="h-4 w-4 mr-1.5" />
          Snooze
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {presets.map((p) => (
          <DropdownMenuItem key={p.label} onClick={() => onSnooze(p.getDate())}>
            {p.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setCustomOpen(true); }}>
              <CalendarDays className="h-4 w-4 mr-2" />
              Custom...
            </DropdownMenuItem>
          </PopoverTrigger>
          <PopoverContent side="left" className="w-64 space-y-3">
            <p className="text-sm font-medium">Pick date & time</p>
            <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
            <Input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
            <Button size="sm" className="w-full" onClick={handleCustom} disabled={!customDate}>
              Snooze
            </Button>
          </PopoverContent>
        </Popover>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
