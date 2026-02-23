import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { mockBeaconSpaces } from "@/lib/beaconMockData";
import { Bot, Globe, Settings, Shield, Hash } from "lucide-react";

export default function BeaconChatManagement() {
  const [cardSettings, setCardSettings] = useState({
    sourceAttribution: true,
    confidenceIndicator: true,
    actionButtons: true,
    propertyDataCard: true,
    relatedBBs: true,
    filingChecklist: true,
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bot className="h-6 w-6 text-[#22c55e]" />
            <h1 className="text-3xl font-bold tracking-tight">Chat Management</h1>
          </div>
          <p className="text-muted-foreground">Beacon bot configuration, card templates, and space management</p>
        </div>

        {/* Deployment Status */}
        <Card>
          <CardHeader><CardTitle className="text-base">Deployment Status</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Railway</p>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#22c55e]" /><span className="text-sm">Connected</span></div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pinecone</p>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#22c55e]" /><span className="text-sm">Connected</span></div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Model</p>
                <span className="text-sm">Claude 3 Haiku</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Active Spaces</p>
                <span className="text-sm">{mockBeaconSpaces.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Space Management */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Hash className="h-4 w-4" /> Active Spaces</CardTitle></CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Space</th>
                    <th className="text-left p-3 font-medium">Members</th>
                    <th className="text-left p-3 font-medium">Questions</th>
                    <th className="text-left p-3 font-medium">Top Topics</th>
                  </tr>
                </thead>
                <tbody>
                  {mockBeaconSpaces.map((s, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3 font-medium">{s.name}</td>
                      <td className="p-3">{s.members}</td>
                      <td className="p-3">{s.questions}</td>
                      <td className="p-3"><div className="flex gap-1">{s.top_topics.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Bot Identity */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4" /> Bot Identity</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Display Name</Label>
                <Input value="Beacon" disabled />
                <p className="text-[10px] text-muted-foreground">Configure in Google Cloud Console → Chat API</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Avatar URL</Label>
                <Input placeholder="https://..." />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Template Settings */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Card Template Settings</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(cardSettings).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between p-2 rounded border">
                  <Label className="text-sm capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</Label>
                  <Switch checked={val} onCheckedChange={(v) => setCardSettings(prev => ({ ...prev, [key]: v }))} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Access Notes */}
        <Card className="border-[#22c55e]/30">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-[#22c55e]" /> Access & Discovery</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>To make Beacon discoverable by all team members:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Go to Google Cloud Console → Chat API → Configuration</li>
              <li>Set visibility to "Available to everyone in your organization"</li>
              <li>Ensure the app is published to your Google Workspace domain</li>
            </ol>
            <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
              <strong>Note:</strong> Google Chat does not fully index bot messages in search. The Ordino Conversations page serves as the searchable archive for all Beacon interactions.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
