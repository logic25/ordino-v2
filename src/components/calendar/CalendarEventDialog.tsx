import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, X } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { useCreateCalendarEvent, useUpdateCalendarEvent, type CalendarEvent } from "@/hooks/useCalendarEvents";
import { useToast } from "@/hooks/use-toast";

const EVENT_TYPES = [
  { value: "general", label: "General" },
  { value: "inspection", label: "Inspection" },
  { value: "hearing", label: "Hearing" },
  { value: "deadline", label: "Deadline" },
  { value: "meeting", label: "Meeting" },
  { value: "site_visit", label: "Site Visit" },
  { value: "filing", label: "Filing" },
  { value: "milestone", label: "Milestone" },
];

interface CalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: Date;
}

export function CalendarEventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
}: CalendarEventDialogProps) {
  const { toast } = useToast();
  const { data: projects } = useProjects();
  const { data: profiles = [] } = useAssignableProfiles();
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [eventType, setEventType] = useState("general");
  const [projectId, setProjectId] = useState<string>("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [locationManuallyEdited, setLocationManuallyEdited] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setLocation(event.location || "");
      setAllDay(event.all_day);
      setEventType(event.event_type);
      setProjectId(event.project_id || "");
      setAttendeeIds(event.metadata?.attendee_ids || []);
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      setStartDate(start.toISOString().split("T")[0]);
      setStartTime(start.toTimeString().slice(0, 5));
      setEndDate(end.toISOString().split("T")[0]);
      setEndTime(end.toTimeString().slice(0, 5));
    } else {
      const d = defaultDate || new Date();
      const dateStr = d.toISOString().split("T")[0];
      setTitle("");
      setDescription("");
      setLocation("");
      setStartDate(dateStr);
      setStartTime("09:00");
      setEndDate(dateStr);
      setEndTime("10:00");
      setAllDay(false);
      setEventType("general");
      setProjectId("");
      setAttendeeIds([]);
      setLocationManuallyEdited(false);
    }
  }, [event, defaultDate, open]);

  // Auto-fill location from project address when project changes
  useEffect(() => {
    if (!projectId || locationManuallyEdited) return;
    const selected = projects?.find((p) => p.id === projectId);
    const address = (selected as any)?.properties?.address;
    if (address) {
      setLocation(address);
    }
  }, [projectId, projects, locationManuallyEdited]);

  const toggleAttendee = (id: string) => {
    setAttendeeIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const removeAttendee = (id: string) => {
    setAttendeeIds((prev) => prev.filter((a) => a !== id));
  };

  const handleSubmit = async () => {
    if (!title || !startDate || !endDate) return;

    const startISO = allDay
      ? `${startDate}T00:00:00`
      : `${startDate}T${startTime}:00`;
    const endISO = allDay
      ? `${endDate}T23:59:59`
      : `${endDate}T${endTime}:00`;

    try {
      if (event) {
        await updateEvent.mutateAsync({
          event_id: event.id,
          title,
          description,
          location,
          start_time: startISO,
          end_time: endISO,
          all_day: allDay,
          event_type: eventType,
          project_id: projectId || undefined,
          attendee_ids: attendeeIds,
        });
        toast({ title: "Event updated" });
      } else {
        await createEvent.mutateAsync({
          title,
          description,
          location,
          start_time: startISO,
          end_time: endISO,
          all_day: allDay,
          event_type: eventType,
          project_id: projectId || undefined,
          attendee_ids: attendeeIds,
        });
        toast({ title: "Event created" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const isLoading = createEvent.isPending || updateEvent.isPending;

  const selectedProfiles = profiles.filter((p) => attendeeIds.includes(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "New Event"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="DOB Inspection, Client Meeting..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Event Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Project</Label>
              <Select value={projectId || "__none__"} onValueChange={(v) => setProjectId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {[p.project_number, (p as any).properties?.address, p.name].filter(Boolean).join(" - ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Team Members / Attendees */}
          <div className="grid gap-2">
            <Label>Team Members</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-start h-auto min-h-10 font-normal"
                  type="button"
                >
                  <Users className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  {selectedProfiles.length === 0 ? (
                    <span className="text-muted-foreground">Add team members...</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {selectedProfiles.map((p) => (
                        <Badge
                          key={p.id}
                          variant="secondary"
                          className="text-xs gap-1"
                        >
                          {p.first_name} {p.last_name}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeAttendee(p.id);
                            }}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {profiles.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={attendeeIds.includes(p.id)}
                        onCheckedChange={() => toggleAttendee(p.id)}
                      />
                      {p.first_name} {p.last_name}
                    </label>
                  ))}
                  {profiles.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-1">No team members found</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={allDay} onCheckedChange={setAllDay} id="all-day" />
            <Label htmlFor="all-day">All Day</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            {!allDay && (
              <div className="grid gap-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {!allDay && (
              <div className="grid gap-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="123 Main St, NYC"
            />
          </div>

          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Notes about this event..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !title}>
            {isLoading ? "Saving..." : event ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
