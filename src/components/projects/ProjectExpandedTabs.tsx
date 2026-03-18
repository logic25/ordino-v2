import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Users, Clock, GitBranch, Mail,
  MessageSquare, File, DollarSign, StickyNote, ClipboardList,
} from "lucide-react";
import { ActionItemsTab } from "./ActionItemsTab";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ServicesTab } from "./tabs/ServicesTab";
import { ContactsTab } from "./tabs/ContactsTab";
import { TimelineTab } from "./tabs/TimelineTab";
import { ChangeOrdersTab } from "./tabs/ChangeOrdersTab";
import { EmailsTab } from "./tabs/EmailsTab";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { TimeLogsTab } from "./tabs/TimeLogsTab";
import { JobCostingTab } from "./tabs/JobCostingTab";
import { NotesTab } from "./tabs/NotesTab";
import { formatCurrency } from "./projectMockData";
import type {
  MockService, MockContact, MockMilestone, MockChangeOrder,
  MockEmail, MockDocument, MockTimeEntry,
} from "./projectMockData";

interface ProjectExpandedTabsProps {
  services: MockService[];
  contacts: MockContact[];
  milestones: MockMilestone[];
  changeOrders: MockChangeOrder[];
  emails: MockEmail[];
  documents: MockDocument[];
  timeEntries: MockTimeEntry[];
  projectId?: string;
}

export function ProjectExpandedTabs({
  services, contacts, milestones, changeOrders, emails, documents, timeEntries, projectId,
}: ProjectExpandedTabsProps) {
  const approvedCOs = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + co.amount, 0);
  const contractTotal = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const adjustedTotal = contractTotal + approvedCOs;
  const billed = services.reduce((s, svc) => s + svc.billedAmount, 0);
  const cost = services.reduce((s, svc) => s + svc.costAmount, 0);

  return (
    <div className="border-l-2 border-primary/30 ml-2">
      <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-5 text-xs flex-wrap">
        <span><span className="text-muted-foreground">Total Project Value:</span> <span className="font-bold text-sm">{formatCurrency(adjustedTotal)}</span></span>
        {approvedCOs > 0 && (
          <span className="text-muted-foreground">(Contract: {formatCurrency(contractTotal)} + COs: {formatCurrency(approvedCOs)})</span>
        )}
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Billed:</span> <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(billed)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Remaining:</span> <span className="font-semibold">{formatCurrency(adjustedTotal - billed)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Cost:</span> <span className="font-semibold">{formatCurrency(cost)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Margin:</span> <span className="font-semibold">{adjustedTotal > 0 ? `${Math.round((adjustedTotal - cost) / adjustedTotal * 100)}%` : "—"}</span></span>
      </div>

      <Tabs defaultValue="services" className="w-full">
        <div className="overflow-x-auto border-b bg-muted/20">
        <TabsList className="w-max justify-start rounded-none bg-transparent h-9 px-4 gap-0">
          <TabsTrigger value="services" className="text-xs gap-1 data-[state=active]:bg-background">
            <FileText className="h-3 w-3" /> Services ({services.length})
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs gap-1 data-[state=active]:bg-background">
            <StickyNote className="h-3 w-3" /> Notes
          </TabsTrigger>
          <TabsTrigger value="emails" className="text-xs gap-1 data-[state=active]:bg-background">
            <Mail className="h-3 w-3" /> Emails ({emails.length})
          </TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs gap-1 data-[state=active]:bg-background">
            <Users className="h-3 w-3" /> Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs gap-1 data-[state=active]:bg-background">
            <Clock className="h-3 w-3" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs gap-1 data-[state=active]:bg-background">
            <File className="h-3 w-3" /> Docs ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="time-logs" className="text-xs gap-1 data-[state=active]:bg-background">
            <Clock className="h-3 w-3" /> Time ({timeEntries.length})
          </TabsTrigger>
          <TabsTrigger value="change-orders" className="text-xs gap-1 data-[state=active]:bg-background">
            <GitBranch className="h-3 w-3" /> COs ({changeOrders.length})
          </TabsTrigger>
          {projectId && (
            <TabsTrigger value="action-items" className="text-xs gap-1 data-[state=active]:bg-background">
              <ClipboardList className="h-3 w-3" /> Tasks
            </TabsTrigger>
          )}
          <TabsTrigger value="job-costing" className="text-xs gap-1 data-[state=active]:bg-background">
            <DollarSign className="h-3 w-3" /> Job Costing
          </TabsTrigger>
          {projectId && (
            <TabsTrigger value="chat" className="text-xs gap-1 data-[state=active]:bg-background">
              <MessageSquare className="h-3 w-3" /> Chat
            </TabsTrigger>
          )}
        </TabsList>
        </div>

        <TabsContent value="services" className="mt-0"><ServicesTab services={services} /></TabsContent>
        <TabsContent value="notes" className="mt-0"><NotesTab /></TabsContent>
        <TabsContent value="emails" className="mt-0"><EmailsTab emails={emails} /></TabsContent>
        <TabsContent value="contacts" className="mt-0"><ContactsTab contacts={contacts} /></TabsContent>
        <TabsContent value="timeline" className="mt-0"><TimelineTab projectId={projectId} /></TabsContent>
        <TabsContent value="documents" className="mt-0"><DocumentsTab documents={documents} /></TabsContent>
        <TabsContent value="time-logs" className="mt-0"><TimeLogsTab timeEntries={timeEntries} /></TabsContent>
        <TabsContent value="change-orders" className="mt-0"><ChangeOrdersTab changeOrders={changeOrders} /></TabsContent>
        {projectId && (
          <TabsContent value="action-items" className="mt-0"><ActionItemsTab projectId={projectId} /></TabsContent>
        )}
        <TabsContent value="job-costing" className="mt-0"><JobCostingTab services={services} timeEntries={timeEntries} /></TabsContent>
        {projectId && (
          <TabsContent value="chat" className="mt-0">
            <div className="h-[400px]">
              <ChatPanel compact className="h-full" />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
