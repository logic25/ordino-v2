import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Loader2, X, Plus, Globe, Clock } from "lucide-react";
import { format } from "date-fns";
import {
  useRfpSources,
  useUpdateRfpSource,
  useRfpMonitoringRules,
  useUpsertMonitoringRules,
} from "@/hooks/useDiscoveredRfps";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MonitoringSettingsDialog({ open, onOpenChange }: Props) {
  const { data: sources = [], isLoading: sourcesLoading } = useRfpSources();
  const { data: rules, isLoading: rulesLoading } = useRfpMonitoringRules();
  const updateSource = useUpdateRfpSource();
  const upsertRules = useUpsertMonitoringRules();
  const { toast } = useToast();

  const [keywordInclude, setKeywordInclude] = useState<string[]>([]);
  const [keywordExclude, setKeywordExclude] = useState<string[]>([]);
  const [minScore, setMinScore] = useState(60);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newExclude, setNewExclude] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rules) {
      setKeywordInclude(rules.keyword_include || []);
      setKeywordExclude(rules.keyword_exclude || []);
      setMinScore(rules.min_relevance_score || 60);
      setNotifyEmail(rules.notify_email ?? true);
      setEmailRecipients(rules.email_recipients || []);
    }
  }, [rules]);

  const addTag = (list: string[], setList: (v: string[]) => void, value: string, setInput: (v: string) => void) => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
    setInput("");
  };

  const removeTag = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.filter((t) => t !== value));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertRules.mutateAsync({
        keyword_include: keywordInclude,
        keyword_exclude: keywordExclude,
        min_relevance_score: minScore,
        notify_email: notifyEmail,
        email_recipients: emailRecipients,
      });
      toast({ title: "Monitoring settings saved" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleSource = async (sourceId: string, active: boolean) => {
    await updateSource.mutateAsync({ id: sourceId, active });
  };

  const loading = sourcesLoading || rulesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>RFP Monitoring Settings</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Sources */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Data Sources
              </Label>
              <div className="space-y-2 mt-2">
                {sources.map((src) => (
                  <div key={src.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{src.source_name}</p>
                        {src.last_checked_at && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            Last checked: {format(new Date(src.last_checked_at), "MMM d, h:mm a")}
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={src.active}
                      onCheckedChange={(checked) => toggleSource(src.id, checked)}
                    />
                  </div>
                ))}
                {sources.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No sources configured. Run a scan to auto-create default sources.
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Include Keywords */}
            <div className="space-y-2">
              <Label className="text-xs">Include Keywords</Label>
              <div className="flex flex-wrap gap-1.5">
                {keywordInclude.map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs gap-1">
                    {kw}
                    <button onClick={() => removeTag(keywordInclude, setKeywordInclude, kw)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Add keyword..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(keywordInclude, setKeywordInclude, newKeyword, setNewKeyword);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => addTag(keywordInclude, setKeywordInclude, newKeyword, setNewKeyword)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Exclude Keywords */}
            <div className="space-y-2">
              <Label className="text-xs">Exclude Keywords</Label>
              <div className="flex flex-wrap gap-1.5">
                {keywordExclude.map((kw) => (
                  <Badge key={kw} variant="outline" className="text-xs gap-1 text-destructive border-destructive/30">
                    {kw}
                    <button onClick={() => removeTag(keywordExclude, setKeywordExclude, kw)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newExclude}
                  onChange={(e) => setNewExclude(e.target.value)}
                  placeholder="Add exclude keyword..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(keywordExclude, setKeywordExclude, newExclude, setNewExclude);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => addTag(keywordExclude, setKeywordExclude, newExclude, setNewExclude)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Relevance Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Minimum Relevance Score</Label>
                <span className="text-sm font-bold tabular-nums text-accent">{minScore}</span>
              </div>
              <Slider
                value={[minScore]}
                onValueChange={([v]) => setMinScore(v)}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-[10px] text-muted-foreground">
                Only RFPs scoring above this threshold will appear in your feed.
              </p>
            </div>

            <Separator />

            {/* Email Notifications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Email Notifications</Label>
                <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
              </div>
              {notifyEmail && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {emailRecipients.map((email) => (
                      <Badge key={email} variant="secondary" className="text-xs gap-1">
                        {email}
                        <button onClick={() => removeTag(emailRecipients, setEmailRecipients, email)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Add email recipient..."
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(emailRecipients, setEmailRecipients, newEmail, setNewEmail);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => addTag(emailRecipients, setEmailRecipients, newEmail, setNewEmail)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
