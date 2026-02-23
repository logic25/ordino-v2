import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockFeedback, type FeedbackEntry } from "@/lib/beaconMockData";
import { MessageCircle, CheckCircle, Lightbulb, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = { pending: "bg-yellow-500", applied: "bg-[#22c55e]", dismissed: "bg-muted-foreground" };

export default function BeaconFeedback() {
  const { toast } = useToast();

  const renderEntry = (entry: FeedbackEntry) => (
    <Card key={entry.id}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{entry.user}</span>
            <span className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
          </div>
          <Badge className={`text-[10px] text-white ${statusColors[entry.status]}`}>{entry.status}</Badge>
        </div>
        {entry.original_question !== "N/A" && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <span className="font-medium">Original question:</span> {entry.original_question}
          </div>
        )}
        <p className="text-sm">{entry.text}</p>
        {entry.status === "pending" && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toast({ title: "Applied" })}>
              <CheckCircle className="h-3 w-3 mr-1" /> Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toast({ title: "Dismissed" })}>Dismiss</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle className="h-6 w-6 text-[#22c55e]" />
            <h1 className="text-3xl font-bold tracking-tight">Feedback & Corrections</h1>
          </div>
          <p className="text-muted-foreground">Team corrections, suggestions, and tips for improving Beacon</p>
        </div>

        <Tabs defaultValue="corrections">
          <TabsList>
            <TabsTrigger value="corrections" className="gap-1.5">
              <AlertCircle className="h-4 w-4" /> Corrections
              <Badge variant="secondary" className="ml-1 text-[10px]">{mockFeedback.filter(f => f.type === "correction").length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-1.5">
              <Lightbulb className="h-4 w-4" /> Suggestions
              <Badge variant="secondary" className="ml-1 text-[10px]">{mockFeedback.filter(f => f.type === "suggestion").length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="tips" className="gap-1.5">
              <CheckCircle className="h-4 w-4" /> Tips
              <Badge variant="secondary" className="ml-1 text-[10px]">{mockFeedback.filter(f => f.type === "tip").length}</Badge>
            </TabsTrigger>
          </TabsList>

          {["corrections", "suggestions", "tips"].map(type => (
            <TabsContent key={type} value={type === "corrections" ? "corrections" : type} className="space-y-3 mt-4">
              {mockFeedback.filter(f => f.type === type.replace(/s$/, "") || f.type === type.slice(0, -1)).map(renderEntry)}
              {mockFeedback.filter(f => {
                const singular = type.endsWith("s") ? type.slice(0, -1) : type;
                return f.type === singular;
              }).length === 0 && (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No items</CardContent></Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
