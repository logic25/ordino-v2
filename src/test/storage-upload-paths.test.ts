import { describe, it, expect } from "vitest";

/**
 * Regression guard for the "storage upload path doesn't match RLS folder"
 * bug class. Every bucket below has an RLS INSERT policy that requires the
 * first folder segment of the object name to equal `get_user_company_id()`.
 * If an upload site drops that prefix, the upload is rejected (or silently
 * stored under a wrong path that no other code can read) and downstream
 * features break in subtle ways — e.g. an RFP email going out with no logo.
 *
 * Each entry asserts the upload-path expression in a known file still
 * derives from a company_id. If a future refactor removes the prefix, this
 * test fails loudly instead of leaking another silent-attachment bug.
 *
 * Sources are loaded via Vite's import.meta.glob (raw) so the test has no
 * Node fs/path dependency and runs identically in CI and the editor.
 */
const sources = import.meta.glob(
  [
    "../components/rfps/tabs/AttachmentsTab.tsx",
    "../components/rfps/tabs/CertificationsTab.tsx",
    "../components/rfps/tabs/StaffBiosTab.tsx",
    "../pages/Rfps.tsx",
    "../pages/Proposals.tsx",
    "../components/documents/DocumentPreviewSheet.tsx",
  ],
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const SITES: Array<{ match: RegExp; needle: string; label: string }> = [
  { label: "AttachmentsTab", match: /AttachmentsTab\.tsx$/, needle: "${profile.company_id}/attachments/" },
  { label: "CertificationsTab", match: /CertificationsTab\.tsx$/, needle: "${profile.company_id}/certifications/" },
  { label: "StaffBiosTab", match: /StaffBiosTab\.tsx$/, needle: "${profile.company_id}/resumes/" },
  { label: "Rfps page", match: /pages\/Rfps\.tsx$/, needle: "${profile.company_id}/uploads/" },
  { label: "Proposals page (signed PDF)", match: /pages\/Proposals\.tsx$/, needle: "${pProfile.company_id}/proposals/" },
  { label: "DocumentPreviewSheet (versions)", match: /DocumentPreviewSheet\.tsx$/, needle: "${doc.company_id}/versions/" },
];

describe("storage upload paths are company-scoped", () => {
  for (const site of SITES) {
    it(`${site.label} prefixes its storage upload path with company_id`, () => {
      const entry = Object.entries(sources).find(([k]) => site.match.test(k));
      expect(entry, `Could not load source matching ${site.match}`).toBeTruthy();
      const [, src] = entry!;
      expect(
        src.includes(site.needle),
        `Expected ${site.label} to construct an upload path containing "${site.needle}". ` +
        `Storage RLS requires the first folder segment to equal company_id; ` +
        `removing this prefix will cause uploads to fail silently.`,
      ).toBe(true);
    });
  }
});
