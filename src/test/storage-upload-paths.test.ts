import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression guard for the "storage upload path doesn't match RLS folder"
 * bug class. Every bucket below has an RLS INSERT policy that requires the
 * first folder segment of the object name to equal `get_user_company_id()`.
 * If an upload site drops that prefix, the upload is rejected (or silently
 * stored under a wrong path that no other code can read) and downstream
 * features break in subtle ways — e.g. an RFP email going out with no logo.
 *
 * Each entry asserts the upload-path expression on a known line still derives
 * from a company_id. If a future refactor removes the prefix, this test fails
 * loudly instead of leaking another silent-attachment bug into production.
 */
const SITES = [
  { file: "src/components/rfps/tabs/AttachmentsTab.tsx", needle: "${profile.company_id}/attachments/" },
  { file: "src/components/rfps/tabs/CertificationsTab.tsx", needle: "${profile.company_id}/certifications/" },
  { file: "src/components/rfps/tabs/StaffBiosTab.tsx", needle: "${profile.company_id}/resumes/" },
  { file: "src/pages/Rfps.tsx", needle: "${profile.company_id}/uploads/" },
  { file: "src/pages/Proposals.tsx", needle: "${pProfile.company_id}/proposals/" },
  { file: "src/components/documents/DocumentPreviewSheet.tsx", needle: "${doc.company_id}/versions/" },
];

describe("storage upload paths are company-scoped", () => {
  for (const { file, needle } of SITES) {
    it(`${file} prefixes its storage upload path with company_id`, () => {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(
        src.includes(needle),
        `Expected ${file} to construct an upload path starting with "${needle}". ` +
        `Storage RLS requires the first folder segment to equal company_id; ` +
        `removing this prefix will cause uploads to fail silently.`,
      ).toBe(true);
    });
  }
});
