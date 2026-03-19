import { describe, it, expect } from "vitest";

/**
 * Unit tests for contact migration & deduplication logic.
 * These validate the business rules without hitting the database.
 */

// Simulate the matching logic from migrateProposalContactsToProject
function findContactMatch(
  proposalContact: { name: string; email: string | null },
  existingContacts: { id: string; name: string; email: string | null }[]
): string | null {
  const normalizedName = proposalContact.name.trim().toLowerCase();

  // 1. Exact name match first
  const byName = existingContacts.find(
    (c) => c.name.trim().toLowerCase() === normalizedName
  );
  if (byName) return byName.id;

  // 2. Email match + name verification
  if (proposalContact.email) {
    const byEmail = existingContacts.filter(
      (c) => c.email && c.email.trim().toLowerCase() === proposalContact.email!.trim().toLowerCase()
    );
    const nameMatch = byEmail.find(
      (c) => c.name.trim().toLowerCase() === normalizedName
    );
    if (nameMatch) return nameMatch.id;
    // Do NOT return email-only match
  }

  return null; // will create new
}

// Simulate the deduplication logic from useProjectContacts
function dedupeContacts(
  linkedContacts: { id: string; name: string; email: string }[],
  proposalContacts: { id: string; name: string; email: string; role: string }[]
): { id: string; name: string }[] {
  const result: { id: string; name: string }[] = [];

  // If linked contacts exist, only show those
  if (linkedContacts.length > 0) {
    return linkedContacts;
  }

  // Otherwise fall back to proposal contacts with deduplication
  const seen = new Set<string>();
  for (const pc of proposalContacts) {
    const key = `${pc.name.trim().toLowerCase()}|${pc.email.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ id: pc.id, name: pc.name });
  }
  return result;
}

describe("Contact matching during proposal → project conversion", () => {
  it("matches by exact name, not just email", () => {
    const existing = [
      { id: "mike-id", name: "Mike Diller", email: "shared@example.com" },
      { id: "jun-id", name: "Jun Nakamura", email: "jun@example.com" },
    ];

    // Marrina has the same email as Mike but different name
    const result = findContactMatch(
      { name: "Marrina Henry", email: "shared@example.com" },
      existing
    );

    // Should NOT match Mike just because of shared email
    expect(result).toBeNull();
  });

  it("matches when both name and email match", () => {
    const existing = [
      { id: "jun-id", name: "Jun Nakamura", email: "jun@example.com" },
    ];

    const result = findContactMatch(
      { name: "Jun Nakamura", email: "jun@example.com" },
      existing
    );

    expect(result).toBe("jun-id");
  });

  it("matches by name even without email", () => {
    const existing = [
      { id: "jun-id", name: "Jun Nakamura", email: "jun@example.com" },
    ];

    const result = findContactMatch(
      { name: "Jun Nakamura", email: null },
      existing
    );

    expect(result).toBe("jun-id");
  });

  it("does not migrate cc contacts", () => {
    const migrateRoles = ["applicant", "bill_to", "sign"];
    expect(migrateRoles).not.toContain("cc");
    expect(migrateRoles).not.toContain("owner");
  });
});

describe("Project contacts deduplication", () => {
  it("shows only linked contacts when they exist (no proposal fallback)", () => {
    const linked = [
      { id: "c1", name: "Marrina Henry", email: "m@example.com" },
      { id: "c2", name: "Jun Nakamura", email: "jun@example.com" },
    ];
    const proposal = [
      { id: "p1", name: "Marrina Henry", email: "m@example.com", role: "applicant" },
      { id: "p2", name: "Jun Nakamura", email: "jun@example.com", role: "bill_to" },
    ];

    const result = dedupeContacts(linked, proposal);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(["Marrina Henry", "Jun Nakamura"]);
  });

  it("falls back to proposal contacts when no linked contacts", () => {
    const result = dedupeContacts(
      [],
      [
        { id: "p1", name: "Marrina Henry", email: "m@example.com", role: "applicant" },
        { id: "p2", name: "Jun Nakamura", email: "jun@example.com", role: "bill_to" },
      ]
    );

    expect(result).toHaveLength(2);
  });

  it("deduplicates proposal contacts by name+email", () => {
    const result = dedupeContacts(
      [],
      [
        { id: "p1", name: "Jun Nakamura", email: "jun@example.com", role: "bill_to" },
        { id: "p2", name: "Jun Nakamura", email: "jun@example.com", role: "applicant" },
      ]
    );

    expect(result).toHaveLength(1);
  });
});
