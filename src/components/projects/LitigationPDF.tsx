import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { format } from "date-fns";
import type { ProjectWithRelations } from "@/hooks/useProjects";
import type {
  MockService, MockContact, MockMilestone,
  MockEmail, MockDocument, MockTimeEntry,
} from "./projectMockData";
import type { ChangeOrder } from "@/hooks/useChangeOrders";

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica.ttf" },
    { src: "https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica-Bold.ttf", fontWeight: "bold" },
  ],
});

const s = StyleSheet.create({
  page: { padding: 50, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  coverPage: { padding: 50, fontSize: 9, fontFamily: "Helvetica", justifyContent: "center", alignItems: "center" },
  coverTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 8, textAlign: "center" },
  coverSubtitle: { fontSize: 14, color: "#555", marginBottom: 40, textAlign: "center" },
  coverMeta: { fontSize: 10, color: "#333", marginBottom: 4, textAlign: "center" },
  coverConfidential: { fontSize: 8, color: "#999", marginTop: 60, textAlign: "center", textTransform: "uppercase", letterSpacing: 2 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 10, marginTop: 20, borderBottomWidth: 1, borderBottomColor: "#333", paddingBottom: 4 },
  subTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 6, marginTop: 12 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 4 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingBottom: 4, marginBottom: 2 },
  col1: { width: "15%" },
  col2: { width: "25%" },
  col3: { width: "60%" },
  colHalf: { width: "50%" },
  colThird: { width: "33%" },
  colQuarter: { width: "25%" },
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic", color: "#666" },
  muted: { color: "#666" },
  critical: { backgroundColor: "#fff3cd", padding: 6, marginVertical: 4, borderLeftWidth: 3, borderLeftColor: "#cc8800" },
  footer: { position: "absolute", bottom: 30, left: 50, right: 50, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#999" },
  badge: { backgroundColor: "#e8e8e8", padding: "2 6", borderRadius: 3, fontSize: 8 },
  certBlock: { marginTop: 40, padding: 16, borderWidth: 1, borderColor: "#333" },
  signatureLine: { borderTopWidth: 1, borderTopColor: "#333", width: 200, marginTop: 40, paddingTop: 4 },
});

interface LitigationPDFProps {
  project: ProjectWithRelations;
  milestones: MockMilestone[];
  emails: MockEmail[];
  documents: MockDocument[];
  timeEntries: MockTimeEntry[];
  changeOrders: ChangeOrder[];
  contacts: MockContact[];
  services: MockService[];
  startDate: Date;
  endDate: Date;
  includes: Record<string, boolean>;
}

const PageFooter = ({ projectNumber }: { projectNumber: string }) => (
  <View style={s.footer} fixed>
    <Text>CONFIDENTIAL — LITIGATION PACKAGE — {projectNumber}</Text>
    <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
);

export function LitigationPDF({
  project, milestones, emails, documents, timeEntries,
  changeOrders, contacts, services, startDate, endDate, includes,
}: LitigationPDFProps) {
  const projectName = project.name || project.proposals?.title || "Untitled Project";
  const projectNumber = project.project_number || "—";
  const address = project.properties?.address || "—";
  const clientName = project.clients?.name || "—";
  const pmName = project.assigned_pm ? [project.assigned_pm.first_name, project.assigned_pm.last_name].filter(Boolean).join(" ") : "—";
  const dateRange = `${format(startDate, "MM/dd/yyyy")} — ${format(endDate, "MM/dd/yyyy")}`;
  const generatedDate = format(new Date(), "MMMM d, yyyy 'at' h:mm a");

  // Build chronological timeline
  const timelineEvents: { date: string; type: string; description: string; details?: string }[] = [];

  if (includes.timeline) {
    milestones.forEach((m) => timelineEvents.push({ date: m.date, type: "Milestone", description: m.event, details: m.details }));
  }
  if (includes.emails) {
    emails.forEach((e) => timelineEvents.push({ date: e.date, type: e.direction === "inbound" ? "Email Received" : "Email Sent", description: `${e.subject} — ${e.from}`, details: e.snippet }));
  }
  if (includes.changeOrders) {
    changeOrders.forEach((co) => {
      timelineEvents.push({ date: co.created_at, type: "Change Order", description: `${co.co_number}: ${co.title} ($${co.amount})`, details: `Reason: ${co.reason || "—"}. Requested by: ${co.requested_by || "—"}. Status: ${co.status}` });
    });
  }
  if (includes.timeLogs) {
    timeEntries.forEach((te) => timelineEvents.push({ date: te.date, type: "Time Entry", description: `${te.user} — ${te.hours}h — ${te.service}`, details: te.description }));
  }

  timelineEvents.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return da - db;
  });

  // Critical decisions (milestones that contain "CRITICAL DECISION" or "override")
  const criticalDecisions = milestones.filter((m) =>
    (m.details || "").toUpperCase().includes("CRITICAL DECISION") ||
    (m.details || "").toLowerCase().includes("override") ||
    (m.details || "").toLowerCase().includes("overrode")
  );

  const totalHours = timeEntries.reduce((s, t) => s + t.hours, 0);
  const contractTotal = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const billed = services.reduce((s, svc) => s + svc.billedAmount, 0);
  const approvedCOs = changeOrders.filter((co) => co.status === "approved").reduce((s, co) => s + co.amount, 0);

  return (
    <Document>
      {/* Cover Page */}
      <Page size="LETTER" style={s.coverPage}>
        <Text style={s.coverTitle}>Litigation Timeline Package</Text>
        <Text style={s.coverSubtitle}>{projectName}</Text>
        <Text style={s.coverMeta}>{address}</Text>
        <Text style={s.coverMeta}>Project #: {projectNumber}</Text>
        <Text style={s.coverMeta}>Client: {clientName}</Text>
        <Text style={s.coverMeta}>Project Manager: {pmName}</Text>
        <Text style={s.coverMeta}>Date Range: {dateRange}</Text>
        <Text style={{ ...s.coverMeta, marginTop: 20 }}>Generated: {generatedDate}</Text>
        <Text style={s.coverConfidential}>
          Confidential — Prepared for Legal Counsel — Attorney-Client Privilege
        </Text>
        <PageFooter projectNumber={projectNumber} />
      </Page>

      {/* Table of Contents */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.sectionTitle}>Table of Contents</Text>
        <View style={s.row}><Text>1. Complete Chronological Timeline</Text></View>
        {includes.emails && <View style={s.row}><Text>2. Communication Log</Text></View>}
        {includes.documents && <View style={s.row}><Text>3. Document Register</Text></View>}
        {includes.decisions && criticalDecisions.length > 0 && <View style={s.row}><Text>4. Critical Decision Points</Text></View>}
        {includes.contacts && <View style={s.row}><Text>5. Project Contacts</Text></View>}
        {includes.timeLogs && <View style={s.row}><Text>6. Time Log Summary</Text></View>}
        {includes.financials && <View style={s.row}><Text>7. Financial Summary</Text></View>}
        {includes.changeOrders && changeOrders.length > 0 && <View style={s.row}><Text>8. Change Orders</Text></View>}
        <View style={s.row}><Text>9. Certification</Text></View>
        <PageFooter projectNumber={projectNumber} />
      </Page>

      {/* Chronological Timeline */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.sectionTitle}>1. Complete Chronological Timeline</Text>
        <Text style={s.muted}>{timelineEvents.length} events from {dateRange}</Text>
        <View style={{ ...s.headerRow, marginTop: 8 }}>
          <Text style={{ ...s.col1, ...s.bold }}>Date</Text>
          <Text style={{ ...s.col2, ...s.bold }}>Type</Text>
          <Text style={{ ...s.col3, ...s.bold }}>Description</Text>
        </View>
        {timelineEvents.map((ev, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.col1}>{ev.date}</Text>
            <Text style={s.col2}>{ev.type}</Text>
            <View style={s.col3}>
              <Text>{ev.description}</Text>
              {ev.details && <Text style={s.italic}>{ev.details}</Text>}
            </View>
          </View>
        ))}
        <PageFooter projectNumber={projectNumber} />
      </Page>

      {/* Communication Log */}
      {includes.emails && (
        <Page size="LETTER" style={s.page}>
          <Text style={s.sectionTitle}>2. Communication Log</Text>
          <View style={s.headerRow}>
            <Text style={{ ...s.col1, ...s.bold }}>Date</Text>
            <Text style={{ ...s.colQuarter, ...s.bold }}>From</Text>
            <Text style={{ ...s.colQuarter, ...s.bold }}>Direction</Text>
            <Text style={{ ...s.colQuarter, ...s.bold }}>Subject</Text>
          </View>
          {emails.map((e, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={s.col1}>{e.date}</Text>
              <Text style={s.colQuarter}>{e.from}</Text>
              <Text style={s.colQuarter}>{e.direction === "inbound" ? "Received" : "Sent"}</Text>
              <Text style={s.colQuarter}>{e.subject}</Text>
            </View>
          ))}
          <PageFooter projectNumber={projectNumber} />
        </Page>
      )}

      {/* Document Register */}
      {includes.documents && (
        <Page size="LETTER" style={s.page}>
          <Text style={s.sectionTitle}>3. Document Register</Text>
          <View style={s.headerRow}>
            <Text style={{ ...s.colThird, ...s.bold }}>Document</Text>
            <Text style={{ ...s.colQuarter, ...s.bold }}>Category</Text>
            <Text style={{ ...s.colQuarter, ...s.bold }}>Uploaded By</Text>
            <Text style={{ width: "17%", ...s.bold }}>Date</Text>
          </View>
          {documents.map((d, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={s.colThird}>{d.name}</Text>
              <Text style={s.colQuarter}>{d.category}</Text>
              <Text style={s.colQuarter}>{d.uploadedBy}</Text>
              <Text style={{ width: "17%" }}>{d.uploadedDate}</Text>
            </View>
          ))}
          <PageFooter projectNumber={projectNumber} />
        </Page>
      )}

      {/* Critical Decisions */}
      {includes.decisions && criticalDecisions.length > 0 && (
        <Page size="LETTER" style={s.page}>
          <Text style={s.sectionTitle}>4. Critical Decision Points</Text>
          <Text style={{ ...s.muted, marginBottom: 8 }}>
            Events where client decisions overrode professional recommendations or significantly altered project direction.
          </Text>
          {criticalDecisions.map((m, i) => (
            <View key={i} style={s.critical} wrap={false}>
              <Text style={s.bold}>{m.date} — {m.event}</Text>
              {m.details && <Text style={{ marginTop: 4 }}>{m.details}</Text>}
            </View>
          ))}
          <PageFooter projectNumber={projectNumber} />
        </Page>
      )}

      {/* Contacts */}
      {includes.contacts && (
        <Page size="LETTER" style={s.page}>
          <Text style={s.sectionTitle}>5. Project Contacts</Text>
          <View style={s.headerRow}>
            <Text style={{ ...s.colQuarter, ...s.bold }}>Name</Text>
            <Text style={{ ...s.colQuarter, ...s.bold }}>Role</Text>
            <Text style={{ ...s.colQuarter, ...s.bold }}>Company</Text>
            <Text style={{ ...s.colQuarter, ...s.bold }}>Contact</Text>
          </View>
          {contacts.map((c, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={s.colQuarter}>{c.name}</Text>
              <Text style={s.colQuarter}>{c.role}</Text>
              <Text style={s.colQuarter}>{c.company}</Text>
              <Text style={s.colQuarter}>{c.email}{"\n"}{c.phone}</Text>
            </View>
          ))}
          <PageFooter projectNumber={projectNumber} />
        </Page>
      )}

      {/* Time Log Summary */}
      {includes.timeLogs && (
        <Page size="LETTER" style={s.page}>
          <Text style={s.sectionTitle}>6. Time Log Summary</Text>
          <Text style={s.muted}>Total: {totalHours} hours across {timeEntries.length} entries</Text>
          <View style={{ ...s.headerRow, marginTop: 8 }}>
            <Text style={{ ...s.col1, ...s.bold }}>Date</Text>
            <Text style={{ ...s.colQuarter, ...s.bold }}>Staff</Text>
            <Text style={{ width: "10%", ...s.bold }}>Hours</Text>
            <Text style={{ width: "25%", ...s.bold }}>Service</Text>
            <Text style={{ width: "25%", ...s.bold }}>Description</Text>
          </View>
          {timeEntries.map((te, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={s.col1}>{te.date}</Text>
              <Text style={s.colQuarter}>{te.user}</Text>
              <Text style={{ width: "10%" }}>{te.hours}h</Text>
              <Text style={{ width: "25%" }}>{te.service}</Text>
              <Text style={{ width: "25%" }}>{te.description}</Text>
            </View>
          ))}
          <PageFooter projectNumber={projectNumber} />
        </Page>
      )}

      {/* Financial Summary */}
      {includes.financials && (
        <Page size="LETTER" style={s.page}>
          <Text style={s.sectionTitle}>7. Financial Summary</Text>
          <View style={s.row}><Text style={s.colHalf}>Original Contract Value:</Text><Text style={s.colHalf}>${contractTotal.toLocaleString()}</Text></View>
          <View style={s.row}><Text style={s.colHalf}>Approved Change Orders:</Text><Text style={s.colHalf}>${approvedCOs.toLocaleString()}</Text></View>
          <View style={{ ...s.row, ...s.bold }}><Text style={s.colHalf}>Adjusted Total Value:</Text><Text style={s.colHalf}>${(contractTotal + approvedCOs).toLocaleString()}</Text></View>
          <View style={s.row}><Text style={s.colHalf}>Amount Billed:</Text><Text style={s.colHalf}>${billed.toLocaleString()}</Text></View>
          <View style={s.row}><Text style={s.colHalf}>Amount Outstanding:</Text><Text style={s.colHalf}>${(contractTotal + approvedCOs - billed).toLocaleString()}</Text></View>
          <View style={s.row}><Text style={s.colHalf}>Total Hours Logged:</Text><Text style={s.colHalf}>{totalHours} hours</Text></View>

          {includes.changeOrders && changeOrders.length > 0 && (
            <>
              <Text style={s.subTitle}>Change Order Detail</Text>
              {changeOrders.map((co, i) => (
                <View key={i} style={s.row} wrap={false}>
                  <Text style={s.colQuarter}>{co.co_number} — {co.status}</Text>
                  <Text style={s.colHalf}>{co.title}</Text>
                  <Text style={s.colQuarter}>${co.amount.toLocaleString()}</Text>
                </View>
              ))}
            </>
          )}
          <PageFooter projectNumber={projectNumber} />
        </Page>
      )}

      {/* Certification */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.sectionTitle}>Certification</Text>
        <View style={s.certBlock}>
          <Text style={{ marginBottom: 8 }}>
            I hereby certify that this Litigation Timeline Package is a true and accurate compilation of all available records related to the above-referenced project for the period of {dateRange}.
          </Text>
          <Text style={{ marginBottom: 8 }}>
            This package was generated on {generatedDate} and includes all communications, documents, time records, financial data, and decision points maintained in the project management system during the specified period.
          </Text>
          <Text style={{ marginBottom: 20 }}>
            Project: {projectName} ({projectNumber}){"\n"}
            Address: {address}{"\n"}
            Client: {clientName}
          </Text>
          <View style={s.signatureLine}>
            <Text>Signature</Text>
          </View>
          <View style={{ ...s.signatureLine, marginTop: 20 }}>
            <Text>Name / Title</Text>
          </View>
          <View style={{ ...s.signatureLine, marginTop: 20 }}>
            <Text>Date</Text>
          </View>
        </View>
        <PageFooter projectNumber={projectNumber} />
      </Page>
    </Document>
  );
}
