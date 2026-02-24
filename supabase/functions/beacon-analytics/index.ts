import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-beacon-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Authenticate with shared secret
  const beaconKey = req.headers.get("x-beacon-key");
  const expectedKey = Deno.env.get("BEACON_ANALYTICS_KEY");
  if (!expectedKey || beaconKey !== expectedKey) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, data } = await req.json();

    switch (action) {
      case "log_interaction":
        return await logInteraction(supabase, data);
      case "log_api_usage":
        return await logApiUsage(supabase, data);
      case "log_suggestion":
        return await logSuggestion(supabase, data);
      case "log_correction":
        return await logCorrection(supabase, data);
      case "log_feedback":
        return await logFeedback(supabase, data);
      case "get_stats":
        return await getStats(supabase, data);
      case "get_recent_conversations":
        return await getRecentConversations(supabase, data);
      case "get_pending_suggestions":
        return await getPendingSuggestions(supabase);
      case "approve_suggestion":
        return await approveSuggestion(supabase, data);
      case "reject_suggestion":
        return await rejectSuggestion(supabase, data);
      case "get_approved_corrections":
        return await getApprovedCorrections(supabase, data);
      case "get_feedback":
        return await getFeedback(supabase, data);
      case "get_roadmap_summary":
        return await getRoadmapSummary(supabase);
      case "create_roadmap_item":
        return await createRoadmapItem(supabase, data);
      case "update_feedback_roadmap":
        return await updateFeedbackRoadmap(supabase, data);
      case "get_question_clusters":
        return jsonResponse([]);
      case "save_content_candidate":
        return await saveContentCandidate(supabase, data);
      case "get_content_candidates":
        return await getContentCandidates(supabase, data);
      case "update_content_candidate":
        return await updateContentCandidate(supabase, data);
      case "save_generated_content":
        return await saveGeneratedContent(supabase, data);
      case "get_generated_content":
        return await getGeneratedContent(supabase, data);
      case "get_document_references":
        return await getDocumentReferences(supabase, data);
      case "get_content_stats":
        return await getContentStats(supabase);
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("beacon-analytics error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});

// ─── Actions ────────────────────────────────────────────────────────

async function logInteraction(sb: any, d: any) {
  const { error } = await sb.from("beacon_interactions").insert({
    timestamp: d.timestamp,
    user_id: d.user_id,
    user_name: d.user_name,
    space_name: d.space_name,
    question: d.question,
    response: d.response,
    command: d.command ?? null,
    answered: d.answered,
    response_length: d.response_length,
    had_sources: d.had_sources,
    sources_used: d.sources_used,
    tokens_used: d.tokens_used,
    cost_usd: d.cost_usd,
    response_time_ms: d.response_time_ms,
    confidence: d.confidence,
    topic: d.topic,
  });
  if (error) throw error;
  return jsonResponse({ success: true });
}

async function logApiUsage(sb: any, d: any) {
  const { error } = await sb.from("beacon_api_usage").insert({
    timestamp: d.timestamp,
    api_name: d.api_name,
    operation: d.operation,
    tokens_used: d.tokens_used,
    cost_usd: d.cost_usd,
  });
  if (error) throw error;
  return jsonResponse({ success: true });
}

async function logSuggestion(sb: any, d: any) {
  const { data, error } = await sb
    .from("beacon_suggestions")
    .insert({
      user_id: d.user_id,
      user_name: d.user_name,
      wrong_answer: d.wrong_answer,
      correct_answer: d.correct_answer,
      topics: d.topics,
      status: "pending",
      timestamp: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return jsonResponse({ success: true, id: data.id });
}

async function logCorrection(sb: any, d: any) {
  const { data, error } = await sb
    .from("beacon_corrections")
    .insert({
      user_id: d.user_id,
      user_name: d.user_name,
      wrong_answer: d.wrong_answer,
      correct_answer: d.correct_answer,
      topics: d.topics,
      applied: true,
      timestamp: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return jsonResponse({ success: true, id: data.id });
}

async function logFeedback(sb: any, d: any) {
  const { data, error } = await sb
    .from("beacon_feedback")
    .insert({
      user_id: d.user_id,
      user_name: d.user_name,
      feedback_text: d.feedback_text,
      status: "new",
      roadmap_status: "backlog",
      priority: "medium",
      timestamp: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return jsonResponse({ success: true, id: data.id });
}

async function getStats(sb: any, d: any) {
  const days = d?.days ?? 30;
  const endDate = d?.end_date
    ? new Date(d.end_date)
    : new Date();
  const startDate = d?.start_date
    ? new Date(d.start_date)
    : new Date(endDate.getTime() - days * 86400000);

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  // Fetch interactions in range
  const { data: interactions, error: intErr } = await sb
    .from("beacon_interactions")
    .select("*")
    .gte("timestamp", startISO)
    .lte("timestamp", endISO);
  if (intErr) throw intErr;

  // Fetch api usage in range
  const { data: apiUsage, error: apiErr } = await sb
    .from("beacon_api_usage")
    .select("*")
    .gte("timestamp", startISO)
    .lte("timestamp", endISO);
  if (apiErr) throw apiErr;

  // Pending suggestions & new feedback (no date filter)
  const { count: pendingSuggestions } = await sb
    .from("beacon_suggestions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: newFeedback } = await sb
    .from("beacon_feedback")
    .select("*", { count: "exact", head: true })
    .eq("status", "new");

  const totalQuestions = interactions.length;
  const answered = interactions.filter((i: any) => i.answered).length;
  const successRate = totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;
  const activeUsers = new Set(interactions.map((i: any) => i.user_id)).size;

  const interactionCost = interactions.reduce((s: number, i: any) => s + (i.cost_usd || 0), 0);
  const apiCost = (apiUsage || []).reduce((s: number, a: any) => s + (a.cost_usd || 0), 0);
  const totalCostUsd = Math.round((interactionCost + apiCost) * 10000) / 10000;

  // Top users
  const userCounts: Record<string, { name: string; count: number }> = {};
  for (const i of interactions) {
    const key = i.user_id;
    if (!userCounts[key]) userCounts[key] = { name: i.user_name || "Unknown", count: 0 };
    userCounts[key].count++;
  }
  const topUsers = Object.values(userCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Topics
  const topicCounts: Record<string, number> = {};
  for (const i of interactions) {
    if (i.topic) {
      topicCounts[i.topic] = (topicCounts[i.topic] || 0) + 1;
    }
  }
  const topics = Object.entries(topicCounts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  // Top questions (exclude commands)
  const questionCounts: Record<string, number> = {};
  for (const i of interactions) {
    if (!i.command && i.question) {
      questionCounts[i.question] = (questionCounts[i.question] || 0) + 1;
    }
  }
  const topQuestions = Object.entries(questionCounts)
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Command usage
  const commandCounts: Record<string, number> = {};
  for (const i of interactions) {
    if (i.command) {
      const cmd = i.command.startsWith("/") ? i.command : `/${i.command}`;
      commandCounts[cmd] = (commandCounts[cmd] || 0) + 1;
    }
  }
  const commandUsage = Object.entries(commandCounts)
    .map(([command, count]) => ({ command, count }))
    .sort((a, b) => b.count - a.count);

  // Daily usage
  const dailyCounts: Record<string, number> = {};
  for (const i of interactions) {
    if (i.timestamp) {
      const date = i.timestamp.includes("T") ? i.timestamp.split("T")[0] : i.timestamp.split(" ")[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    }
  }
  const dailyUsage = Object.entries(dailyCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Response time stats
  const times = interactions
    .map((i: any) => i.response_time_ms)
    .filter((t: any) => t != null && t > 0);
  const responseTime = times.length > 0
    ? {
        avg_ms: Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length),
        min_ms: Math.min(...times),
        max_ms: Math.max(...times),
      }
    : { avg_ms: 0, min_ms: 0, max_ms: 0 };

  const filteredTopics = topics.filter(t => t.topic !== "COMMAND");

  return jsonResponse({
    total_questions: totalQuestions,
    answered,
    success_rate: successRate,
    active_users: activeUsers,
    total_cost_usd: totalCostUsd,
    top_users: topUsers,
    topics: filteredTopics,
    top_questions: topQuestions,
    command_usage: commandUsage,
    daily_usage: dailyUsage,
    response_time: responseTime,
    pending_suggestions: pendingSuggestions ?? 0,
    new_feedback: newFeedback ?? 0,
  });
}

async function getRecentConversations(sb: any, d: any) {
  const limit = d?.limit ?? 20;
  let query = sb
    .from("beacon_interactions")
    .select("timestamp, user_name, question, response, command, answered, sources_used, topic, confidence, response_time_ms, cost_usd")
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (d?.user_id) {
    query = query.eq("user_id", d.user_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return jsonResponse(data);
}

async function getPendingSuggestions(sb: any) {
  const { data, error } = await sb
    .from("beacon_suggestions")
    .select("id, timestamp, user_name, wrong_answer, correct_answer, topics")
    .eq("status", "pending")
    .order("timestamp", { ascending: false });
  if (error) throw error;
  return jsonResponse(data);
}

// ─── New Actions ────────────────────────────────────────────────────

async function approveSuggestion(sb: any, d: any) {
  const { data, error } = await sb
    .from("beacon_suggestions")
    .update({ status: "approved", reviewed_by: d.reviewed_by, reviewed_at: new Date().toISOString() })
    .eq("id", d.suggestion_id)
    .select()
    .single();
  if (error) throw error;
  return jsonResponse(data);
}

async function rejectSuggestion(sb: any, d: any) {
  const { data, error } = await sb
    .from("beacon_suggestions")
    .update({ status: "rejected", reviewed_by: d.reviewed_by, reviewed_at: new Date().toISOString() })
    .eq("id", d.suggestion_id)
    .select()
    .single();
  if (error) throw error;
  return jsonResponse(data);
}

async function getApprovedCorrections(sb: any, d: any) {
  const limit = d?.limit ?? 50;
  const { data, error } = await sb
    .from("beacon_suggestions")
    .select("id, timestamp, user_name, wrong_answer, correct_answer, reviewed_by, reviewed_at")
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return jsonResponse({ corrections: data });
}

async function getFeedback(sb: any, d: any) {
  const limit = d?.limit ?? 50;
  let query = sb
    .from("beacon_feedback")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(limit);
  if (d?.status) {
    query = query.eq("status", d.status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return jsonResponse({ feedback: data });
}

async function getRoadmapSummary(sb: any) {
  const { data, error } = await sb
    .from("beacon_feedback")
    .select("id, feedback_text, user_name, priority, target_quarter, roadmap_status, notes")
    .not("roadmap_status", "is", null);
  if (error) throw error;

  const byStatus: Record<string, number> = {};
  const itemsByStatus: Record<string, any[]> = {};
  for (const item of data || []) {
    const s = item.roadmap_status;
    byStatus[s] = (byStatus[s] || 0) + 1;
    if (!itemsByStatus[s]) itemsByStatus[s] = [];
    itemsByStatus[s].push(item);
  }

  return jsonResponse({ by_status: byStatus, items_by_status: itemsByStatus, items: data });
}

async function createRoadmapItem(sb: any, d: any) {
  const { data, error } = await sb
    .from("beacon_feedback")
    .insert({
      feedback_text: d.title,
      user_id: d.user_id || "system",
      user_name: d.created_by ?? "admin",
      feedback_type: "roadmap",
      roadmap_status: d.roadmap_status ?? "backlog",
      priority: d.priority ?? "medium",
      target_quarter: d.target_quarter ?? null,
      notes: d.notes ?? null,
      status: "new",
      timestamp: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return jsonResponse({ success: true, id: data.id });
}

async function updateFeedbackRoadmap(sb: any, d: any) {
  const updates: Record<string, any> = {};
  if (d.roadmap_status !== undefined) updates.roadmap_status = d.roadmap_status;
  if (d.priority !== undefined) updates.priority = d.priority;
  if (d.target_quarter !== undefined) updates.target_quarter = d.target_quarter;
  if (d.notes !== undefined) updates.notes = d.notes;

  const { data, error } = await sb
    .from("beacon_feedback")
    .update(updates)
    .eq("id", d.feedback_id)
    .select()
    .single();
  if (error) throw error;
  return jsonResponse(data);
}

// ─── Content Pipeline Actions ───────────────────────────────────────

async function saveContentCandidate(sb: any, d: any) {
  const { data, error } = await sb
    .from("content_candidates")
    .upsert({
      id: d.id,
      title: d.title,
      content_type: d.content_type ?? "blog_post",
      priority: d.priority ?? "medium",
      status: d.status ?? "pending",
      relevance_score: d.relevance_score ?? 50,
      demand_score: d.demand_score ?? null,
      expertise_score: d.expertise_score ?? null,
      search_interest: d.search_interest ?? "unknown",
      affects_services: d.affects_services ?? [],
      key_topics: d.key_topics ?? [],
      reasoning: d.reasoning ?? "",
      review_question: d.review_question ?? null,
      content_angle: d.content_angle ?? null,
      team_questions_count: d.team_questions_count ?? 0,
      team_questions: d.team_questions ?? [],
      most_common_angle: d.most_common_angle ?? null,
      source_type: d.source_type ?? "question_cluster",
      source_url: d.source_url ?? null,
      source_email_id: d.source_email_id ?? null,
      content_preview: d.content_preview ?? null,
      recommended_format: d.recommended_format ?? null,
      estimated_minutes: d.estimated_minutes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return jsonResponse(data);
}

async function getContentCandidates(sb: any, d: any) {
  let query = sb
    .from("content_candidates")
    .select("*")
    .order("relevance_score", { ascending: false });
  if (d?.status) query = query.eq("status", d.status);
  if (d?.content_type) query = query.eq("content_type", d.content_type);
  if (d?.limit) query = query.limit(d.limit);
  const { data, error } = await query;
  if (error) throw error;
  return jsonResponse(data);
}

async function updateContentCandidate(sb: any, d: any) {
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of ["status", "priority", "title", "content_type", "relevance_score", "content_angle", "content_preview", "recommended_format", "estimated_minutes"]) {
    if (d[key] !== undefined) updates[key] = d[key];
  }
  const { data, error } = await sb
    .from("content_candidates")
    .update(updates)
    .eq("id", d.id)
    .select()
    .single();
  if (error) throw error;
  return jsonResponse(data);
}

async function saveGeneratedContent(sb: any, d: any) {
  const { data, error } = await sb
    .from("generated_content")
    .insert({
      id: d.id,
      candidate_id: d.candidate_id,
      content_type: d.content_type ?? "blog_post",
      title: d.title,
      content: d.content,
      word_count: d.word_count ?? 0,
      status: d.status ?? "draft",
    })
    .select()
    .single();
  if (error) throw error;

  // Update candidate status to drafted
  if (d.candidate_id) {
    await sb
      .from("content_candidates")
      .update({ status: "drafted", updated_at: new Date().toISOString() })
      .eq("id", d.candidate_id);
  }

  return jsonResponse(data);
}

async function getGeneratedContent(sb: any, d: any) {
  let query = sb
    .from("generated_content")
    .select("*, content_candidates(*)")
    .order("generated_at", { ascending: false });
  if (d?.status) query = query.eq("status", d.status);
  if (d?.candidate_id) query = query.eq("candidate_id", d.candidate_id);
  if (d?.limit) query = query.limit(d.limit);
  const { data, error } = await query;
  if (error) throw error;
  return jsonResponse(data);
}

async function getDocumentReferences(sb: any, d: any) {
  const days = d?.days ?? 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await sb
    .from("beacon_interactions")
    .select("sources_used, question")
    .gte("timestamp", since)
    .not("sources_used", "is", null);
  if (error) throw error;

  const docCounts: Record<string, { count: number; questions: string[] }> = {};
  for (const row of data || []) {
    let sources: string[] = [];
    try { sources = JSON.parse(row.sources_used); } catch { continue; }
    for (const src of sources) {
      const name = typeof src === "string" ? src : (src as any).name || (src as any).title || String(src);
      if (!docCounts[name]) docCounts[name] = { count: 0, questions: [] };
      docCounts[name].count++;
      if (docCounts[name].questions.length < 3 && row.question) {
        docCounts[name].questions.push(row.question);
      }
    }
  }

  const references = Object.entries(docCounts)
    .map(([document_name, d]) => ({ document_name, reference_count: d.count, sample_questions: d.questions }))
    .sort((a, b) => b.reference_count - a.reference_count);

  return jsonResponse(references);
}

async function getContentStats(sb: any) {
  const { data: candidates, error: cErr } = await sb.from("content_candidates").select("status, content_type");
  if (cErr) throw cErr;
  const { data: generated, error: gErr } = await sb.from("generated_content").select("status, content_type");
  if (gErr) throw gErr;

  const candidatesByStatus: Record<string, number> = {};
  const candidatesByType: Record<string, number> = {};
  for (const c of candidates || []) {
    candidatesByStatus[c.status] = (candidatesByStatus[c.status] || 0) + 1;
    candidatesByType[c.content_type] = (candidatesByType[c.content_type] || 0) + 1;
  }

  const generatedByStatus: Record<string, number> = {};
  for (const g of generated || []) {
    generatedByStatus[g.status] = (generatedByStatus[g.status] || 0) + 1;
  }

  return jsonResponse({
    candidates: { total: (candidates || []).length, by_status: candidatesByStatus, by_type: candidatesByType },
    generated: { total: (generated || []).length, by_status: generatedByStatus },
  });
}
