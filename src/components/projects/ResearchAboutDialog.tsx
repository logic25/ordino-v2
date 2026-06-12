import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Info, ChevronDown, ChevronRight, BookOpen, Sparkles } from "lucide-react";

const SYSTEM_PROMPT = `You are a NYC building code research assistant for project managers at a NYC expediting firm.

Your goal is to answer code questions clearly and practically — not just quote the regulation.

Style:
- Plain text only. No markdown, headers, bold, bullets, or emojis.
- Write in short paragraphs a PM can skim.
- Lead with the direct answer, then cite the code section, then state the practical implication for the filing (e.g., "this means you'll need TR-1 special inspection", or "this changes the egress calc to require a second stair").

Scope:
- NYC Building Code (2014 and 2022 — note which applies when relevant)
- Zoning Resolution
- Multiple Dwelling Law
- NYC Mechanical, Plumbing, Fire, Energy Conservation codes
- DOB rules, BSA decisions, LPC requirements when relevant

Hard rules:
- Always cite specific section numbers (e.g., "BC §1003.4", "ZR §23-631", "MDL §53"). If unsure of the exact number, say "verify the exact section number" — do not guess.
- Never invent code sections or requirements.
- If you don't know, say: "I don't have enough information to answer this definitively — consult the code chapter or contact DOB directly."
- When the project filing type is Pro-Cert, factor in that the architect/engineer is self-certifying (no DOB plan exam) and call out anything that changes the requirements.

Context provided per question: property address, filing type, scope of work. Use it.`;

const EXAMPLE_QUESTIONS = [
  "Do I need a sprinkler for a 3-story commercial alt with 4,200 sq ft per floor?",
  "What's the egress width for an occupant load of 75 in a B-occupancy?",
  "Can I file a horizontal enlargement as Alt-2 under the 2014 code?",
  "What TR forms are required for a Pro-Cert plumbing alt?",
  "Does this scope trigger a TPP (Tenant Protection Plan)?",
  "What's the minimum ceiling height for a habitable room under MDL?",
];

export function ResearchAboutDialog() {
  const [open, setOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
          <Info className="h-3.5 w-3.5" /> How this works
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Code Research — How this works
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-3 text-sm">
            <p className="leading-relaxed">
              Ask any NYC building, zoning, mechanical, plumbing, fire, or energy code question. The tool first
              searches our internal knowledge base (Beacon KB). If it finds a confident match (≥72% with at least 2
              good sources), it answers from there.
              If not, it falls back to general AI knowledge — clearly badged so you know.
            </p>

            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-700">Beacon KB</Badge>
              <span className="text-muted-foreground">Answered from our curated knowledge base with citations.</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="border-blue-500/40 text-blue-700">AI Knowledge</Badge>
              <span className="text-muted-foreground">No good KB match — answered from general AI training. Verify the section numbers.</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="border-amber-500/40 text-amber-700">Hybrid</Badge>
              <span className="text-muted-foreground">Combined KB sources + AI to fill gaps.</span>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Example questions
              </h4>
              <ul className="space-y-1.5">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <li key={q} className="text-sm leading-snug pl-3 border-l-2 border-muted">{q}</li>
                ))}
              </ul>
            </div>

            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setShowPrompt((s) => !s)}
              >
                {showPrompt ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Show full system prompt
              </button>
              {showPrompt && (
                <pre className="mt-2 p-3 rounded-md bg-muted/50 border text-[11px] leading-relaxed whitespace-pre-wrap font-mono">
                  {SYSTEM_PROMPT}
                </pre>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
