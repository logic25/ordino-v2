import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjects from "./tools/list-projects";
import searchProjects from "./tools/search-projects";
import getProject from "./tools/get-project";
import getProjectTimeline from "./tools/get-project-timeline";
import listProjectNotes from "./tools/list-project-notes";
import listProjectActionItems from "./tools/list-project-action-items";
import listOpenActionItems from "./tools/list-open-action-items";
import listDobApplications from "./tools/list-dob-applications";
import getDobApplication from "./tools/get-dob-application";
import listFilings from "./tools/list-filings";
import searchClients from "./tools/search-clients";
import getClient from "./tools/get-client";
import searchContacts from "./tools/search-contacts";
import listProperties from "./tools/list-properties";
import getProperty from "./tools/get-property";

// Issuer MUST be the direct Supabase host, not the .lovable.cloud proxy.
// VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time so this stays
// import-safe (no runtime env read at module load).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ordino-mcp",
  title: "Ordino",
  version: "0.1.0",
  instructions: [
    "Ordino is Green Light Expediting's NYC construction expediting CRM.",
    "All tools are READ-ONLY and run as the signed-in user (respects row-level",
    "security and per-company scoping). Every call is written to an audit log.",
    "Use search_* tools to find records, then get_* / list_* to drill in.",
    "Financial data (invoices, billing amounts, employee compensation),",
    "internal staff notes, settings, and Beacon analytics are intentionally",
    "not exposed.",
  ].join(" "),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listProjects,
    searchProjects,
    getProject,
    getProjectTimeline,
    listProjectNotes,
    listProjectActionItems,
    listOpenActionItems,
    listDobApplications,
    getDobApplication,
    listFilings,
    searchClients,
    getClient,
    searchContacts,
    listProperties,
    getProperty,
  ],
});
