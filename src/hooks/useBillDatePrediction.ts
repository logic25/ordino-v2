import { supabase } from "@/integrations/supabase/client";
import { addDays, format } from "date-fns";

interface BillDatePrediction {
  serviceId: string;
  predictedDate: string; // ISO date
  confidenceDays: number; // +/- range
  basedOnSamples: number;
}

/**
 * Predicts estimated bill dates for services based on historical data.
 * Looks at how long similar service types took from project creation to billing,
 * then applies that average to the current project's start date.
 */
export async function predictBillDates(
  projectId: string,
  companyId: string,
  services: Array<{ id: string; name: string; status: string; estimatedBillDate: string | null }>
): Promise<BillDatePrediction[]> {
  // Only predict for services that don't already have a bill date and aren't billed/paid
  const needsPrediction = services.filter(
    s => !s.estimatedBillDate && !["billed", "paid", "dropped"].includes(s.status)
  );

  if (needsPrediction.length === 0) return [];

  // Get the current project's creation date
  const { data: project } = await supabase
    .from("projects")
    .select("created_at")
    .eq("id", projectId)
    .single();

  if (!project) return [];

  const projectStart = new Date(project.created_at);

  // Check project readiness — if checklist has outstanding items, add a buffer
  const { data: checklistItems } = await supabase
    .from("project_checklist_items")
    .select("id, status")
    .eq("project_id", projectId);

  const hasChecklist = checklistItems && checklistItems.length > 0;
  const outstandingItems = hasChecklist
    ? checklistItems.filter((i: any) => i.status !== "done").length
    : 0;
  const checklistComplete = hasChecklist && outstandingItems === 0;

  // Fetch historical billing data: services that have been billed with their project creation dates
  const { data: historicalServices } = await supabase
    .from("services")
    .select("name, created_at, billed_at, status")
    .eq("company_id", companyId)
    .in("status", ["billed", "paid"])
    .not("billed_at", "is", null)
    .limit(500);

  if (!historicalServices || historicalServices.length === 0) return [];

  // Build a map of service name patterns → days to bill
  const daysMap = new Map<string, number[]>();

  for (const hs of historicalServices) {
    if (!hs.billed_at || !hs.created_at) continue;
    const created = new Date(hs.created_at);
    const billed = new Date(hs.billed_at);
    const days = Math.round((billed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0 || days > 730) continue; // skip outliers

    // Normalize name for matching: extract key patterns like "ALT-2", "Work Permit", "LOC", etc.
    const normalizedName = normalizeServiceName(hs.name);
    const existing = daysMap.get(normalizedName) || [];
    existing.push(days);
    daysMap.set(normalizedName, existing);
  }

  // Calculate global average as fallback
  const allDays = Array.from(daysMap.values()).flat();
  const globalAvg = allDays.length > 0
    ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length)
    : 90; // Default 90 days if no historical data

  const predictions: BillDatePrediction[] = [];

  for (const svc of needsPrediction) {
    const normalizedName = normalizeServiceName(svc.name);
    const matchedDays = daysMap.get(normalizedName) || [];

    let avgDays: number;
    let samples: number;
    let confidence: number;

    if (matchedDays.length >= 3) {
      // Good sample size for this service type
      avgDays = Math.round(matchedDays.reduce((a, b) => a + b, 0) / matchedDays.length);
      samples = matchedDays.length;
      const stdDev = Math.sqrt(matchedDays.reduce((sum, d) => sum + (d - avgDays) ** 2, 0) / matchedDays.length);
      confidence = Math.round(stdDev);
    } else if (matchedDays.length > 0) {
      // Some data, lower confidence
      avgDays = Math.round(matchedDays.reduce((a, b) => a + b, 0) / matchedDays.length);
      samples = matchedDays.length;
      confidence = 30;
    } else {
      // No matching data, use global average
      avgDays = globalAvg;
      samples = 0;
      confidence = 45;
    }

    let predictedDate = addDays(projectStart, avgDays);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Never predict a date in the past
    if (predictedDate < today) {
      // If checklist isn't complete, estimate at least 14 days out
      // If complete, estimate 7 days out (filing + processing)
      const minDaysOut = checklistComplete ? 7 : 14;
      predictedDate = addDays(today, minDaysOut);
    } else if (!checklistComplete && hasChecklist) {
      // Even if historical avg gives a future date, ensure it accounts for
      // outstanding checklist items — add 3 days per outstanding item (capped at 30)
      const readinessBuffer = Math.min(outstandingItems * 3, 30);
      const readinessAdjusted = addDays(today, readinessBuffer);
      if (readinessAdjusted > predictedDate) {
        predictedDate = readinessAdjusted;
      }
    }

    predictions.push({
      serviceId: svc.id,
      predictedDate: format(predictedDate, "yyyy-MM-dd"),
      confidenceDays: confidence,
      basedOnSamples: samples,
    });
  }

  return predictions;
}

/**
 * Normalize service name to find similar historical services.
 * Strips CO# prefixes, numbers, and extracts the core service type.
 */
function normalizeServiceName(name: string): string {
  let normalized = name
    .replace(/^CO#?\d+\s*[-–—]\s*/i, "") // Remove CO# prefix
    .replace(/\s*[-–—]\s*(GC|PL|SP|MECH|ELEC|STR|FA|FS|ELEV|BLR|STP)$/i, "") // Remove discipline suffix
    .trim()
    .toLowerCase();

  // Map common variations to canonical names
  const patterns: [RegExp, string][] = [
    [/alt(eration)?\s*(type\s*)?\d/i, "alteration"],
    [/work\s*permit/i, "work_permit"],
    [/letter\s*of\s*completion|loc\b/i, "loc"],
    [/oer\b|environmental/i, "oer"],
    [/temporary\s*cert|tco\b/i, "tco"],
    [/cert\s*of\s*occupancy|c\s*of\s*o/i, "co_cert"],
    [/sign.?off/i, "sign_off"],
    [/violation/i, "violation"],
    [/amendment/i, "amendment"],
    [/approval/i, "approval"],
    [/inspection/i, "inspection"],
  ];

  for (const [pattern, canonical] of patterns) {
    if (pattern.test(normalized)) return canonical;
  }

  return normalized;
}

/**
 * Applies AI predictions to services by updating their estimated_bill_date in the DB.
 */
export async function applyBillDatePredictions(predictions: BillDatePrediction[]): Promise<void> {
  const updates = predictions.map(p =>
    supabase
      .from("services")
      .update({ estimated_bill_date: p.predictedDate } as any)
      .eq("id", p.serviceId)
  );

  await Promise.all(updates);
}
