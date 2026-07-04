import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import QARow from "./QARow";
import type { PermitPlaybook } from "@/hooks/usePermitPlaybooks";
import { useAddCustomSlot } from "@/hooks/usePermitPlaybooks";
import { PLAYBOOK_STANDARD_SLOTS } from "@/lib/permitPlaybookTemplate";

export default function QAList({
  playbook, marketName, state,
}: { playbook: PermitPlaybook; marketName: string; state: string }) {
  const [newQ, setNewQ] = useState("");
  const add = useAddCustomSlot();
  const standardIds = new Set(PLAYBOOK_STANDARD_SLOTS.map((s) => s.id));

  return (
    <div className="space-y-2">
      {playbook.qa.map((slot) => (
        <QARow
          key={slot.id}
          playbook={playbook}
          slot={slot}
          marketName={marketName}
          state={state}
          isCustom={!standardIds.has(slot.id)}
        />
      ))}
      <div className="flex gap-2 pt-2">
        <Input
          value={newQ}
          onChange={(e) => setNewQ(e.target.value)}
          placeholder="Add a custom question…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newQ.trim()) {
              add.mutate({ playbook, question: newQ.trim() });
              setNewQ("");
            }
          }}
        />
        <Button
          variant="outline"
          onClick={() => {
            if (!newQ.trim()) return;
            add.mutate({ playbook, question: newQ.trim() });
            setNewQ("");
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}
