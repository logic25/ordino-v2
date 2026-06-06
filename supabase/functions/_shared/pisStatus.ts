// Shared PIS-gap computation. Mirrors src/hooks/useProjectDetail.ts useProjectPISStatus
// so beacon-qa / summarize-project don't depend on the dead pis_tracking table.
//
// Source of truth: the latest rfi_requests row for a project. Its `sections` jsonb
// describes the PIS schema; `responses` jsonb has the answers.

export interface PisStatus {
  totalFields: number;
  completedFields: number;
  missingFields: string[];
  sentDate: string | null;
}

const EXCLUDED_SECTION_IDS = new Set(["notes"]);
const GATING_FIELD_IDS = new Set([
  "gc_same_as", "tpp_same_as", "sia_same_as",
  "gc_known", "tpp_known", "sia_known",
]);
const EXTRA_OPTIONAL_IDS = new Set([
  "plans_upload", "applicant_work_types",
  "corp_officer_name", "corp_officer_title",
]);
const SKIP_FIELD_TYPES = new Set([
  "heading", "file_upload", "work_type_picker", "checkbox_group",
]);

function isEmpty(v: any): boolean {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim().length === 0;
}

export async function computePisStatusFromRfi(
  admin: any,
  projectId: string,
): Promise<PisStatus> {
  const { data: rfi } = await admin
    .from("rfi_requests")
    .select("id, sections, responses, submitted_at, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!rfi) {
    return { totalFields: 0, completedFields: 0, missingFields: [], sentDate: null };
  }

  const sections = (rfi.sections ?? []) as any[];
  const responses = (rfi.responses ?? {}) as Record<string, any>;

  const getVal = (sectionId: string, fieldId: string) =>
    responses[`${sectionId}_${fieldId}`] ?? responses[fieldId];

  // Conditional exclusions for GC / TPP / SIA blocks
  const conditionallyExcluded = new Set<string>();

  const gcSame = getVal("contractors_inspections", "gc_same_as") || getVal("gc", "gc_same_as");
  const gcHas = !!(getVal("contractors_inspections", "gc_name") || getVal("gc", "gc_name"));
  const gcFieldIds = ["gc_name", "gc_company", "gc_phone", "gc_email", "gc_address", "gc_dob_tracking", "gc_hic_lic"];
  if (gcSame || !gcHas) gcFieldIds.forEach((id) => conditionallyExcluded.add(id));

  const tppSame = getVal("contractors_inspections", "tpp_same_as") || getVal("tpp", "tpp_same_as") || responses["tpp_same_as"];
  const tppHas = !!(getVal("contractors_inspections", "tpp_name") || getVal("tpp", "tpp_name"));
  const tppContact = ["tpp_name", "tpp_email"];
  const tppExtra = ["rent_controlled", "rent_stabilized", "units_occupied"];
  if (tppSame) {
    tppContact.forEach((id) => conditionallyExcluded.add(id));
  } else if (!tppHas) {
    [...tppContact, ...tppExtra].forEach((id) => conditionallyExcluded.add(id));
  }

  const siaSame = getVal("contractors_inspections", "sia_same_as") || getVal("sia", "sia_same_as") || responses["sia_same_as"];
  const siaHas = !!(getVal("contractors_inspections", "sia_name") || getVal("sia", "sia_name"));
  const siaFieldIds = ["sia_name", "sia_company", "sia_phone", "sia_email", "sia_number", "sia_nys_lic"];
  if (siaSame || !siaHas) siaFieldIds.forEach((id) => conditionallyExcluded.add(id));

  const all: { id: string; label: string; sectionId: string }[] = [];
  for (const section of sections) {
    if (EXCLUDED_SECTION_IDS.has(section.id)) continue;
    for (const field of (section.fields ?? [])) {
      if (SKIP_FIELD_TYPES.has(field.type)) continue;
      if (field.optional) continue;
      const fid = field.id as string;
      if (EXTRA_OPTIONAL_IDS.has(fid)) continue;
      if (GATING_FIELD_IDS.has(fid)) continue;
      if (conditionallyExcluded.has(fid)) continue;
      all.push({ id: fid, label: (field.label || fid) as string, sectionId: section.id });
    }
  }

  const missing = all.filter((f) => {
    const v = responses[`${f.sectionId}_${f.id}`] ?? responses[f.id];
    return isEmpty(v);
  });

  return {
    totalFields: all.length,
    completedFields: all.length - missing.length,
    missingFields: missing.map((f) => f.label),
    sentDate: (rfi.submitted_at as string) || (rfi.created_at as string) || null,
  };
}
