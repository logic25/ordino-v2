import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, BookOpen } from "lucide-react";
import { ResearchWorkspace } from "./ResearchWorkspace";
import { CodeResearchPanel } from "./CodeResearchPanel";

interface ResearchTabContainerProps {
  projectId: string;
  projectAddress?: string;
  architectEmail?: string;
  filingType?: string;
  scopeOfWork?: string;
}

export function ResearchTabContainer({
  projectId,
  projectAddress,
  architectEmail,
  filingType,
  scopeOfWork,
}: ResearchTabContainerProps) {
  const [activeTab, setActiveTab] = useState("objections");

  return (
    <div className="space-y-0">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-4 pt-2">
          <TabsList className="h-8">
            <TabsTrigger value="objections" className="text-xs gap-1.5 h-7">
              <AlertCircle className="h-3.5 w-3.5" />
              Objections
            </TabsTrigger>
            <TabsTrigger value="code-research" className="text-xs gap-1.5 h-7">
              <BookOpen className="h-3.5 w-3.5" />
              Code Research
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="objections" className="mt-0">
          <ResearchWorkspace
            projectId={projectId}
            projectAddress={projectAddress}
            architectEmail={architectEmail}
            filingType={filingType}
            scopeOfWork={scopeOfWork}
          />
        </TabsContent>
        <TabsContent value="code-research" className="mt-0">
          <div className="h-[calc(100vh-320px)] min-h-[500px]">
            <CodeResearchPanel
              projectId={projectId}
              projectAddress={projectAddress}
              filingType={filingType}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
