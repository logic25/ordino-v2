import { useMemo } from "react";

interface Project {
  id: string;
  name: string | null;
  project_number: string | null;
  properties?: { address: string } | null;
}

interface EmailForMatching {
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  snippet: string | null;
}

/**
 * Scores projects against an email's subject, sender, and snippet.
 * Returns projects sorted by match score (highest first), with only matches > 0.
 */
export function useProjectSuggestions(
  email: EmailForMatching | null,
  projects: Project[]
) {
  return useMemo(() => {
    if (!email || projects.length === 0) return [];

    // Build searchable text from the email
    const emailText = [
      email.subject,
      email.from_email,
      email.from_name,
      email.snippet,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!emailText.trim()) return [];

    const scored = projects
      .map((project) => {
        let score = 0;

        // Check project number match (strongest signal)
        if (project.project_number) {
          const pn = project.project_number.toLowerCase();
          if (emailText.includes(pn)) {
            score += 10;
          }
        }

        // Check address match — try full address and significant parts
        if (project.properties?.address) {
          const addr = project.properties.address.toLowerCase();
          if (emailText.includes(addr)) {
            score += 8;
          } else {
            // Try matching the street number + street name (first two words)
            const parts = addr.split(/[\s,]+/).filter(Boolean);
            if (parts.length >= 2) {
              const streetPrefix = parts.slice(0, 2).join(" ");
              if (streetPrefix.length >= 5 && emailText.includes(streetPrefix)) {
                score += 5;
              }
            }
          }
        }

        // Check project name match
        if (project.name) {
          const name = project.name.toLowerCase();
          if (name.length >= 4 && emailText.includes(name)) {
            score += 3;
          }
        }

        return { project, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map((s) => s.project);
  }, [email, projects]);
}
