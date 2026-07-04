import { useState } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import {
  useEventTasks, useCreateEventTask, useUpdateEventTask, useDeleteEventTask,
} from "@/hooks/useEventTasks";
import { useCompanyProfiles } from "@/hooks/useProfiles";

export function EventTasksCard({ eventId }: { eventId: string }) {
  const tasks = useEventTasks(eventId);
  const create = useCreateEventTask();
  const update = useUpdateEventTask();
  const del = useDeleteEventTask();
  const profiles = useCompanyProfiles();

  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string>("__none");
  const [due, setDue] = useState("");

  const reset = () => {
    setTitle("");
    setAssignee("__none");
    setDue("");
  };

  const add = async () => {
    const t = title.trim();
    if (!t) return;
    await create.mutateAsync({
      event_id: eventId,
      title: t,
      assigned_to: assignee === "__none" ? null : assignee,
      due_date: due || null,
    });
    reset();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <CheckSquare className="h-3.5 w-3.5" />Tasks
      </p>

      <div className="space-y-1">
        {(tasks.data ?? []).map((t) => {
          const done = t.status === "done";
          const assigneeName =
            [t.assignee?.first_name, t.assignee?.last_name].filter(Boolean).join(" ") ||
            t.assignee?.display_name ||
            "Unassigned";
          return (
            <div
              key={t.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/40 group"
            >
              <Checkbox
                checked={done}
                onCheckedChange={(v) =>
                  update.mutate({
                    id: t.id,
                    event_id: eventId,
                    status: v ? "done" : "open",
                  })
                }
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>
                  {t.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {assigneeName}
                  {t.due_date && ` · Due ${format(new Date(t.due_date + "T12:00:00"), "MMM d")}`}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                onClick={() => del.mutate({ id: t.id, event_id: eventId })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        {(tasks.data ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground py-2">No tasks yet.</p>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center pt-2 border-t">
        <Input
          placeholder="Add a prep task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          className="h-8"
        />
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="Assign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Unassigned</SelectItem>
            {(profiles.data ?? []).map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="h-8 w-36"
        />
        <Button size="sm" disabled={!title.trim() || create.isPending} onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}
