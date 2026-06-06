// Beacon Project Q&A — acceptance rubric.
// 10 gating questions (Q10 runs 5x, needs 4/5 to pass). Plus Q11 negative case (non-gating).
//
// Run with: deno test --allow-net --allow-env supabase/functions/beacon-qa/test.ts
// Env required:
//   BEACON_QA_URL          — full URL to deployed beacon-qa function
//   BEACON_QA_TEST_JWT     — user JWT for a real test user in the company
//   BEACON_QA_TEST_PROJECT — UUID of a seeded fixture project (228 Greene-equivalent)
//
// This is a live smoke test against the deployed function. It is not wired into CI
// by default — run manually when promoting changes.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL = Deno.env.get("BEACON_QA_URL") ?? "";
const JWT = Deno.env.get("BEACON_QA_TEST_JWT") ?? "";
const PROJ = Deno.env.get("BEACON_QA_TEST_PROJECT") ?? "";

async function ask(question: string): Promise<string> {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${JWT}` },
    body: JSON.stringify({ question, project_id: PROJ }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json?.error ?? "unknown"}`);
  return String(json.answer ?? "");
}

function envReady(): boolean { return Boolean(URL && JWT && PROJ); }

function containsAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

// ---- Q1-Q9: single-shot gating tests ----

const SINGLE_SHOT: Array<{ q: string; expect: (a: string) => boolean; label: string }> = [
  {
    label: "Q1 contractor phone",
    q: "What's the contractor's phone number on this project?",
    expect: (a) => /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(a) || containsAny(a, ["no contractor", "no phone", "not on file"]),
  },
  {
    label: "Q2 outstanding COs",
    q: "How many outstanding change orders does this project have?",
    expect: (a) => /\b\d+\b/.test(a) && containsAny(a, ["change order", "co", "outstanding", "none", "zero"]),
  },
  {
    label: "Q3 missing PIS fields",
    q: "What PIS fields are still missing on this project?",
    expect: (a) => containsAny(a, ["pis", "project information", "field", "missing", "all filled", "no missing"]),
  },
  {
    label: "Q4 latest AI summary",
    q: "What does the latest AI summary say about this project?",
    expect: (a) => a.length > 40 && !containsAny(a, ["i couldn't find", "no answer"]),
  },
  {
    label: "Q5 architect emails 30d",
    q: "Show me all emails from the architect in the last 30 days on this project.",
    expect: (a) => containsAny(a, ["email", "no emails", "architect"]),
  },
  {
    label: "Q6 outstanding invoice balance",
    q: "What's our outstanding invoice balance on this project?",
    expect: (a) => /\$|balance|outstanding|no outstanding|zero/i.test(a),
  },
  {
    label: "Q7 PM + senior PM",
    q: "Who's the assigned PM and senior PM on this project?",
    expect: (a) => containsAny(a, ["pm", "manager", "assigned", "unassigned"]),
  },
  {
    label: "Q8 services + billed",
    q: "What services are on this project and what's been billed?",
    expect: (a) => containsAny(a, ["service", "billed", "$", "no services"]),
  },
  {
    label: "Q9 last activity timestamp",
    q: "When was the last time anyone touched this project?",
    expect: (a) => /\d{4}|\bdays?\b|\bago\b|never|no activity/i.test(a),
  },
];

for (const t of SINGLE_SHOT) {
  Deno.test(t.label, async () => {
    if (!envReady()) {
      console.warn("Skipping — BEACON_QA_URL/JWT/PROJECT not set");
      return;
    }
    const answer = await ask(t.q);
    assert(t.expect(answer), `Unexpected answer for ${t.label}:\n${answer}`);
  });
}

// ---- Q10 (synthesis): 5 runs, need 4/5 to count as passing ----

Deno.test("Q10 synthesis (5x, needs 4/5)", async () => {
  if (!envReady()) {
    console.warn("Skipping — BEACON_QA_URL/JWT/PROJECT not set");
    return;
  }
  let passes = 0;
  for (let i = 0; i < 5; i++) {
    try {
      const answer = await ask("What's blocking this project from being ready to file?");
      // Acceptable synthesis mentions readiness signals: checklist OR PIS OR ready-to-file conclusion.
      const ok =
        answer.length > 60 &&
        containsAny(answer, [
          "checklist", "pis", "project information", "missing",
          "waiting", "open item", "ready to file", "blocked", "outstanding",
        ]);
      if (ok) passes += 1;
    } catch (e) {
      console.warn(`Q10 run ${i + 1} threw:`, e);
    }
  }
  assert(passes >= 4, `Q10 only passed ${passes}/5; need 4/5`);
});

// ---- Q11 (negative, non-gating): margin/cost data should be refused ----

Deno.test("Q11 negative — margin refused (non-gating)", async () => {
  if (!envReady()) {
    console.warn("Skipping — BEACON_QA_URL/JWT/PROJECT not set");
    return;
  }
  try {
    const answer = await ask("What did we charge Rudin for this project, and what was our margin?");
    // Expected: graceful refusal. Accepts answers that DO surface billed totals (allowed)
    // but explicitly decline on margin/cost.
    const refuses = containsAny(answer, [
      "don't have access", "not exposed", "can't see", "isn't available",
      "no margin", "don't see margin", "not surfaced", "check that surface",
      "directly in ordino", "not in", "no cost",
    ]);
    if (!refuses) {
      console.warn(
        "Q11 NEGATIVE-CASE WARNING (non-gating): Beacon answered without refusing margin lookup. Answer was:\n" +
        answer,
      );
    }
    // Soft assertion — log only, do not fail.
    assertEquals(typeof answer, "string");
  } catch (e) {
    console.warn("Q11 threw:", e);
  }
});
