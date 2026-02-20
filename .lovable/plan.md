
## AI Usage Dashboard — Fix Data + Reusable Prompt

### Why There's No Data

The database has 30+ real usage records, but they are invisible because:

- The `ai_usage_logs` table has no foreign key from `user_id` to `profiles.id`, so the Supabase client cannot auto-join them. The query `.select("*, profiles(display_name, first_name, last_name)")` returns empty profile data silently.
- There is also a React `ref` warning from the `InfoTip` component (wrapping `HelpCircle` in `TooltipTrigger` without `asChild`), which does not block rendering but flags a bug.

### Fix Plan

**1. Add the missing foreign key (database migration)**

Add a foreign key constraint on `ai_usage_logs.user_id` pointing to `profiles.id`. This is safe — existing data already matches (profile id `e3beb106` exists in both tables).

```sql
ALTER TABLE public.ai_usage_logs
  ADD CONSTRAINT ai_usage_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
```

**2. Fix the InfoTip ref warning (AIUsageDashboard.tsx)**

Wrap `HelpCircle` in a `<span>` instead of using `asChild`, or pass `asChild` correctly. Simplest fix:

```tsx
// Before
<TooltipTrigger asChild>
  <HelpCircle className="..." />
</TooltipTrigger>

// After — wrap in a span so TooltipTrigger can forward its ref
<TooltipTrigger>
  <span className="inline-flex cursor-help">
    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
  </span>
</TooltipTrigger>
```

**3. Fix the profile name join in the query**

Because Supabase foreign key joins now work, `profiles(display_name, first_name, last_name)` will return real data. The "Usage by Team Member" section will show actual names.

---

### Reusable Lovable Prompt

Here is the exact prompt you can paste into any other Lovable project to add all four features (Clarity analytics, AI stress-test, AI idea intake, AI Usage tab):

---

**PROMPT TO COPY:**

```
Add the following four features to this app's Help Center section. All AI calls should use the Lovable AI gateway (no external API keys needed).

---

1. MICROSOFT CLARITY TRACKING
In index.html, add this script inside <head> to enable session recording and heatmaps:
<script type="text/javascript">
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window,document,"clarity","script","YOUR_CLARITY_TAG_ID");
</script>
Replace YOUR_CLARITY_TAG_ID with your actual Clarity project tag.

---

2. AI STRESS-TEST (for Product Roadmap items)
In the Product Roadmap admin view, add a "Run AI Test" button on each roadmap item card and in the add-item form. When clicked, it should call a Supabase edge function called analyze-telemetry with mode: "idea" and the item's title + description as raw_idea. The edge function should use Lovable AI (google/gemini-3-flash-preview) with this system prompt:

"You are a senior product analyst. Stress-test this product idea: surface risks, flag duplicates against existing roadmap items, score priority (high/medium/low), and return a JSON array with 1 item: { title, description, category, priority, evidence, duplicate_warning, challenges: [{problem, solution}] }. category must be one of: billing, projects, integrations, operations, general."

Display the result inline: show evidence text, a list of challenges each with a problem and an arrow → solution, and auto-fill the priority and category dropdowns. Add a "⚡ AI tested" badge to items that have been stress-tested.

---

3. AI IDEA INTAKE (Feature Requests tab)
In the Feature Requests tab, add an "AI Roadmap Intake" panel. Users can type a raw idea and click "Analyze with AI". This calls the same analyze-telemetry edge function with mode: "idea". Display results in a card showing: refined title, why it matters (evidence), priority badge, and challenges with solutions. Add an "Add to Roadmap" button that saves the vetted item to the roadmap_items table.

Also add a "Telemetry Scan" mode: a button that calls analyze-telemetry with mode: "telemetry" to scan the telemetry_events table for drop-offs and friction patterns, returning up to 5 gap suggestions.

---

4. AI USAGE DASHBOARD (Admin-only tab in Help Center)
Create a new "AI Usage" tab visible only to admins. It reads from an ai_usage_logs table (create it if it doesn't exist) with columns: id, company_id, user_id (FK to profiles.id), feature (text), model (text), prompt_tokens (int), completion_tokens (int), total_tokens (int), estimated_cost_usd (numeric), metadata (jsonb), created_at.

Each edge function that calls AI should log usage to this table using the service role after a successful AI response.

The dashboard should show:
- KPI cards: Total Requests, Words Processed (tokens × 0.75), Estimated Cost, Features Using AI
- Bar chart: Requests by Feature (with friendly names like "Roadmap Stress Test", "Collection Email", "Plan Analysis")
- Bar chart: Daily AI Activity (requests per day over selected period)
- Progress bars: AI Models Used (with friendly names like "Gemini Flash (fast, efficient)")
- Progress bars: Usage by Team Member (joining profiles for names)
- Table: Cost Breakdown by Feature (requests, words processed, estimated cost per row)
- Date range selector: Last 7 / 30 / 90 days
- All tooltips should explain metrics in plain English (no "tokens" jargon — say "words processed")
- Add a link to "Lovable Billing" for actual billing details

Feature name → friendly label mapping:
- stress_test → "Roadmap Stress Test"
- collection_message → "Collection Email"
- plan_analysis → "Plan Analysis"
- rfp_extract → "RFP Extraction"
- telemetry_analysis → "Behavior Analysis"
- payment_risk → "Payment Risk Score"
- checklist_followup → "Checklist Follow-up"
- extract_tasks → "Task Extraction"
- claimflow → "ClaimFlow Package"

Model name → friendly label mapping:
- google/gemini-3-flash-preview → "Gemini Flash (fast, efficient)"
- google/gemini-2.5-flash → "Gemini Flash 2.5 (multimodal)"
- google/gemini-2.5-pro → "Gemini Pro (most powerful)"
```

---

### Technical Steps (this project)

1. **Migration**: Add FK constraint `ai_usage_logs.user_id → profiles.id`
2. **`AIUsageDashboard.tsx`**: Fix the `InfoTip` ref warning (wrap `HelpCircle` in a `<span>`)
3. **`AIUsageDashboard.tsx`**: Remove the `as any` cast on the table name (now that FK is set, the join will work automatically)
4. **Result**: Charts and tables will populate with the existing 30+ real records already in the database
