// Pre-built content skeletons. Static by design (like Beacon's Flask prototype) —
// picking one in "Compose from Scratch" pre-fills the editor so you start with
// structure, not a blank page. Tuned for Green Light's DOB / expediting world.

export interface ContentTemplate {
  id: string;
  name: string;
  category: string;
  icon: string;            // emoji, matches the Beacon dashboard cards
  content_type: "blog_post" | "newsletter";
  description: string;
  body: string;            // markdown skeleton with [placeholders]
}

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    id: "industry-update",
    name: "Industry Update",
    category: "Updates",
    icon: "📋",
    content_type: "blog_post",
    description: "Announce a DOB / regulatory change with impact analysis and action items.",
    body: `# [DOB / Regulatory] [Update Title]

**Effective Date:** [Date]
**Impact Level:** [High / Medium / Low]

## What Changed
[Describe the change in 2-3 sentences.]

## Who It Affects
[Owners, GCs, architects — which filings or property types.]

## What You Need to Do
- [Action item 1]
- [Action item 2]

## How Green Light Helps
[One line on how GLE handles this — invite the reader to reach out: info@greenlightexpediting.com]
`,
  },
  {
    id: "how-to-guide",
    name: "How-To Guide",
    category: "Guides",
    icon: "📝",
    content_type: "blog_post",
    description: "Step-by-step procedure for a common DOB task clients or your team need to follow.",
    body: `# How to [Task Name]

*Estimated time: [X minutes/hours] · Difficulty: [Easy / Medium / Complex]*

## Prerequisites
- [Requirement 1]
- [Requirement 2]

## Steps
1. [Step one]
2. [Step two]
3. [Step three]

## Common Pitfalls
- [What trips people up]

## When to Call an Expeditor
[The point where DIY gets risky — GLE can take it from here: info@greenlightexpediting.com]
`,
  },
  {
    id: "case-study",
    name: "Case Study Spotlight",
    category: "Case Studies",
    icon: "🔍",
    content_type: "blog_post",
    description: "Showcase a real project with the challenge, what GLE did, and the outcome.",
    body: `# Case Study: [Client / Project Name]

**Industry:** [Industry]
**Project Type:** [Type]
**Duration:** [Timeline]

## The Challenge
[What the client was up against — objection, deadline, violation, CO hold-up.]

## What We Did
[The approach GLE took.]

## The Outcome
[Result — permit issued, objection cleared, CO obtained, time/cost saved.]

## Takeaway
[The lesson for similar owners — reach out: info@greenlightexpediting.com]
`,
  },
  {
    id: "weekly-digest",
    name: "Weekly Digest",
    category: "Newsletters",
    icon: "🗞️",
    content_type: "newsletter",
    description: "Weekly summary of activity, corrections, and new content for your list.",
    body: `# Beacon Weekly — [Date Range]

## 🔥 Trending This Week
[Top topics and question trends.]

## 📝 Knowledge Base Updates
[New documents, corrections applied.]

## 📰 New Content
[Blog posts / advisories published this week.]

## ❓ Most Asked
[The single most-asked question and its answer.]
`,
  },
  {
    id: "client-advisory",
    name: "Client Advisory",
    category: "Advisories",
    icon: "⚡",
    content_type: "newsletter",
    description: "Urgent note to clients about a compliance deadline or important change.",
    body: `# ⚡ Client Advisory: [Topic]

**Date:** [Date]
**Priority:** URGENT
**Affects:** [Who is affected]

---

## What's Happening
[The deadline or change, in one short paragraph.]

## The Deadline
[Date and what's due.]

## What to Do Now
- [Action item]

## We Can Handle It
[How GLE takes this off their plate — info@greenlightexpediting.com]
`,
  },
];
