import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2 } from "lucide-react";
import type { MockService } from "../projectMockData";

export function ServiceDetail({ service }: { service: MockService }) {
  return (
    <div className="px-6 py-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Scope of Work (Internal)</h4>
          <p className="text-sm whitespace-pre-line">{service.scopeOfWork || "No scope defined."}</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Job Description (DOB)</h4>
          {service.jobDescription ? (
            <p className="text-sm whitespace-pre-line">{service.jobDescription}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No job description — required for DOB filing.</p>
          )}
        </div>
      </div>

      {service.estimatedCosts && service.estimatedCosts.length > 0 && (
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Est. Cost:</span>
          {service.estimatedCosts.map((ec, i) => (
            <span key={i} className="text-sm">{ec.discipline}: <span className="font-semibold" data-clarity-mask="true">${ec.amount.toLocaleString()}</span></span>
          ))}
        </div>
      )}

      {service.tasks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Tasks
          </h4>
          <div className="space-y-1.5">
            {service.tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={task.done} className="h-3.5 w-3.5" />
                <span className={task.done ? "line-through text-muted-foreground" : ""}>{task.text}</span>
                {task.assignedTo && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">{task.assignedTo}</Badge>
                )}
                {task.dueDate && (
                  <span className="text-[10px] text-muted-foreground">{task.dueDate}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground font-medium">Application:</span>
        {service.application ? (
          <Badge variant="outline" className="font-mono text-xs">#{service.application.jobNumber} {service.application.type}</Badge>
        ) : (
          <span className="text-muted-foreground italic">Not filed yet</span>
        )}
        <button className="text-xs text-primary hover:underline">Change</button>
      </div>
    </div>
  );
}
