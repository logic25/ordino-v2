import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_FILE_LINES = 1500;
const MAX_TOTAL_BYTES = 80_000;

type Attachment = { url: string; name: string; type: string };

function parseAttachments(raw: unknown): Attachment[] {
  if (!raw) return [];
  try {
    return Array.isArray(raw) ? raw as Attachment[] : JSON.parse(raw as string);
  } catch {
    return [];
  }
}

function inferLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", json: "json",
    css: "css", html: "html", md: "md", sql: "sql", py: "py",
    sh: "bash", yml: "yaml", yaml: "yaml", toml: "toml",
  };
  return map[ext] ?? "";
}

async function fetchGitHubFile(
  repo: string,
  branch: string,
  path: string,
  token: string,
): Promise<{ contents: string; tooLarge: boolean } | { error: string }> {
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw",
      "User-Agent": "ordino-assemble-fix-prompt",
    },
  });
  if (!res.ok) {
    return { error: `${res.status} ${res.statusText}` };
  }
  const text = await res.text();
  const lineCount = text.split("\n").length;
  if (lineCount > MAX_FILE_LINES) {
    return { contents: "", tooLarge: true };
  }
  return { contents: text, tooLarge: false };
}

function scorePattern(
  pattern: { affected_files?: string[] | null; pattern_name?: string | null; root_cause?: string | null },
  suggestedFiles: string[],
  bugText: string,
): number {
  let score = 0;
  const pFiles = pattern.affected_files ?? [];
  for (const pf of pFiles) {
    if (suggestedFiles.some((sf) => sf.includes(pf) || pf.includes(sf))) score += 3;
  }
  const haystack = `${pattern.pattern_name ?? ""} ${pattern.root_cause ?? ""}`.toLowerCase();
  const needles = bugText.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const matched = new Set<string>();
  for (const n of needles) {
    if (haystack.includes(n)) matched.add(n);
  }
  score += Math.min(matched.size, 5);
  return score;
}

function buildMarkdown(opts: {
  bug: any;
  triageMissing: boolean;
  attachments: Attachment[];
  patterns: Array<{ pattern_name: string; occurrences: number; root_cause: string | null; fix_pattern: string | null }>;
  fileBlocks: string[];
  fileWarnings: string[];
  targetTool: "claude_code" | "lovable";
  ghConfigured: boolean;
}): string {
  const { bug, triageMissing, attachments, patterns, fileBlocks, fileWarnings, targetTool, ghConfigured } = opts;
  const pageMatch = bug.title?.match(/^\[([^\]]+)\]/);
  const page = pageMatch ? pageMatch[1] : "Unknown";
  const cleanTitle = (bug.title ?? "").replace(/^\[[^\]]+\]\s*/, "");

  const lines: string[] = [];
  lines.push(`# Bug Fix Request — ${cleanTitle}`);
  lines.push("");
  lines.push(`- **Bug ID:** \`${bug.id}\``);
  lines.push(`- **Page:** ${page}`);
  lines.push(`- **Priority (user-set):** ${bug.priority ?? "—"}`);
  lines.push(`- **Status:** ${bug.status ?? "—"}`);
  lines.push(`- **Destination tool:** ${targetTool === "claude_code" ? "Claude Code" : "Lovable"}`);
  lines.push("");

  lines.push("## Reproduction");
  lines.push("");
  lines.push((bug.description ?? "(no description)").toString().replace(/\\n/g, "\n"));
  if (bug.loom_url) {
    lines.push("");
    lines.push(`**Loom:** ${bug.loom_url}`);
  }
  if (attachments.length) {
    lines.push("");
    lines.push("**Screenshots:**");
    for (const a of attachments) lines.push(`- ${a.url}`);
  }
  lines.push("");

  lines.push("## AI Triage");
  lines.push("");
  if (triageMissing) {
    lines.push("> No AI triage has been run for this bug yet. Diagnose from scratch using the reproduction above.");
  } else {
    lines.push(`- **AI severity:** ${bug.ai_severity ?? "—"}`);
    if (bug.ai_diagnosis) {
      lines.push("");
      lines.push("**Diagnosis:**");
      lines.push("");
      lines.push(bug.ai_diagnosis);
    }
    if (Array.isArray(bug.ai_suggested_files) && bug.ai_suggested_files.length > 0) {
      lines.push("");
      lines.push("**Suggested files:**");
      for (const f of bug.ai_suggested_files) lines.push(`- \`${f}\``);
    }
  }
  lines.push("");

  lines.push("## Similar Past Bugs");
  lines.push("");
  if (patterns.length === 0) {
    lines.push("_None matched._");
  } else {
    for (const p of patterns) {
      lines.push(`- **${p.pattern_name}** — seen ${p.occurrences}×`);
      if (p.root_cause) lines.push(`  - Root cause: ${p.root_cause}`);
      if (p.fix_pattern) lines.push(`  - Previous fix: ${p.fix_pattern}`);
    }
  }
  lines.push("");

  lines.push("## Current File Contents");
  lines.push("");
  if (!ghConfigured) {
    lines.push("> _GitHub token not configured — agent should read suggested files directly before editing._");
  } else if (fileBlocks.length === 0) {
    lines.push("> _No file contents available._");
  } else {
    for (const block of fileBlocks) {
      lines.push(block);
      lines.push("");
    }
  }
  if (fileWarnings.length) {
    lines.push("");
    for (const w of fileWarnings) lines.push(`> ${w}`);
  }
  lines.push("");

  lines.push("## Acceptance Criteria");
  lines.push("");
  lines.push("- [ ] Original reproduction no longer reproduces");
  lines.push("- [ ] No regressions in adjacent components listed above");
  lines.push("- [ ] Tests pass (`bun run test` if a test file is touched)");
  lines.push("- [ ] Changelog entry added per project rule");
  lines.push("");

  lines.push("## Note for AI Agent");
  lines.push("");
  if (targetTool === "claude_code") {
    lines.push("You have filesystem access — re-read files before editing in case they changed since this prompt was generated.");
  } else {
    lines.push("Apply the smallest change that fixes the bug. Reference the file paths above.");
  }
  lines.push("");

  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ---- Auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const bug_id = body.bug_id as string | undefined;
    const target_tool = (body.target_tool === "claude_code" ? "claude_code" : "lovable") as
      | "claude_code"
      | "lovable";
    if (!bug_id) {
      return new Response(JSON.stringify({ error: "bug_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Company guard
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const { data: bug } = await supabase
      .from("feature_requests")
      .select("*")
      .eq("id", bug_id)
      .maybeSingle();
    if (!bug || !callerProfile?.company_id || callerProfile.company_id !== bug.company_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const triageMissing = !bug.ai_diagnosis;
    const attachments = parseAttachments(bug.attachments);
    const suggestedFiles: string[] = Array.isArray(bug.ai_suggested_files)
      ? bug.ai_suggested_files.filter((f: unknown) => typeof f === "string" && !f.endsWith("/"))
      : [];

    // Top 3 similar patterns
    const { data: allPatterns } = await supabase
      .from("bug_patterns")
      .select("pattern_name, occurrences, root_cause, fix_pattern, affected_files")
      .eq("company_id", bug.company_id)
      .limit(50);
    const bugText = `${bug.title ?? ""} ${bug.description ?? ""}`;
    const ranked = (allPatterns ?? [])
      .map((p: any) => ({ p, score: scorePattern(p, suggestedFiles, bugText) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.p);

    // GitHub fetch
    const ghToken = Deno.env.get("GITHUB_TOKEN");
    const ghRepo = Deno.env.get("GITHUB_REPO");
    const ghBranch = Deno.env.get("GITHUB_BRANCH") || "main";
    const ghConfigured = !!(ghToken && ghRepo);

    const fileBlocks: string[] = [];
    const fileWarnings: string[] = [];
    let totalBytes = 0;

    if (ghConfigured && suggestedFiles.length > 0) {
      // Sort smallest first — fetch in parallel
      const results = await Promise.all(
        suggestedFiles.map(async (path) => {
          const r = await fetchGitHubFile(ghRepo!, ghBranch, path, ghToken!);
          return { path, r };
        }),
      );
      // Keep stable order; track total size
      for (const { path, r } of results) {
        if ("error" in r) {
          fileWarnings.push(`Could not fetch \`${path}\` from GitHub (${r.error}).`);
          continue;
        }
        if (r.tooLarge) {
          fileBlocks.push(
            `### \`${path}\`\n\n_File exceeds ${MAX_FILE_LINES} lines — agent should read directly._`,
          );
          continue;
        }
        const lang = inferLanguage(path);
        const block = `### \`${path}\`\n\n\`\`\`${lang}\n${r.contents}\n\`\`\``;
        if (totalBytes + block.length > MAX_TOTAL_BYTES) {
          fileWarnings.push(`Omitted \`${path}\` to stay under prompt size cap.`);
          continue;
        }
        totalBytes += block.length;
        fileBlocks.push(block);
      }
    }

    const markdown = buildMarkdown({
      bug,
      triageMissing,
      attachments,
      patterns: ranked as any,
      fileBlocks,
      fileWarnings,
      targetTool: target_tool,
      ghConfigured,
    });

    return new Response(
      JSON.stringify({
        success: true,
        prompt: markdown,
        files_included: fileBlocks.length,
        patterns_included: ranked.length,
        github_configured: ghConfigured,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("assemble-fix-prompt error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
