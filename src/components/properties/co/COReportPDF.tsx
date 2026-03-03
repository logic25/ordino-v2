import {
  Document, Page, Text, View, StyleSheet, Font,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import type { COApplication, COViolation, COSignOff, ReportSnapshot } from "./coMockData";
import { WORK_TYPE_LABELS } from "./coMockData";
import type { RequiredItem } from "./requiredItemsData";

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica.ttf" },
    { src: "https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica-Bold.ttf", fontWeight: "bold" },
  ],
});

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 4 },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 6, fontSize: 8, color: "#555" },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginTop: 16, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: "#ddd", paddingBottom: 3 },
  summaryBox: { backgroundColor: "#f5f5f5", borderRadius: 4, padding: 10, marginBottom: 8 },
  summaryText: { fontSize: 9, lineHeight: 1.5, marginBottom: 3 },
  bold: { fontWeight: "bold" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0", paddingVertical: 4, alignItems: "center" },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingBottom: 4, marginBottom: 2 },
  col1: { width: "15%" },
  col2: { width: "20%" },
  col3: { width: "15%" },
  col4: { width: "12%" },
  col5: { width: "12%" },
  col6: { width: "13%" },
  col7: { width: "13%" },
  headerText: { fontSize: 8, fontWeight: "bold", color: "#333" },
  cellText: { fontSize: 8 },
  deltaCards: { flexDirection: "row", gap: 8, marginBottom: 12 },
  deltaCard: { flex: 1, borderWidth: 0.5, borderColor: "#ddd", borderRadius: 4, padding: 8, alignItems: "center" },
  deltaLabel: { fontSize: 7, color: "#888", textTransform: "uppercase", marginBottom: 2 },
  deltaValue: { fontSize: 16, fontWeight: "bold" },
  deltaChange: { fontSize: 7, marginTop: 2 },
  appCard: { borderWidth: 0.5, borderColor: "#ddd", borderRadius: 4, padding: 8, marginBottom: 6 },
  appHeader: { flexDirection: "row", gap: 6, marginBottom: 4, alignItems: "center" },
  appJobNum: { fontSize: 10, fontWeight: "bold", fontFamily: "Courier" },
  appBadge: { fontSize: 7, backgroundColor: "#eee", borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1 },
  appDesc: { fontSize: 8, marginBottom: 3 },
  appMeta: { flexDirection: "row", gap: 16, fontSize: 7, color: "#666", marginBottom: 3 },
  appAction: { backgroundColor: "#f0f0f0", borderRadius: 3, padding: 5, fontSize: 8, marginBottom: 3 },
  bisItem: { borderLeftWidth: 2, borderLeftColor: "#9333ea", paddingLeft: 6, marginBottom: 3, marginLeft: 4 },
  bisTitle: { fontSize: 8, fontWeight: "bold", color: "#7e22ce" },
  bisText: { fontSize: 7, color: "#555" },
  reqItemSection: { borderLeftWidth: 2, borderLeftColor: "#2563eb", paddingLeft: 6, marginTop: 4, marginLeft: 4 },
  reqItemTitle: { fontSize: 8, fontWeight: "bold", color: "#1d4ed8", marginBottom: 2 },
  reqItemRow: { flexDirection: "row", gap: 4, marginBottom: 1.5 },
  reqItemName: { fontSize: 7, flex: 1 },
  reqItemDate: { fontSize: 7, color: "#666", width: 60 },
  reqItemStatus: { fontSize: 7, width: 50 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: "#ddd", paddingTop: 6, fontSize: 7, color: "#888", flexDirection: "row", justifyContent: "space-between" },
  stepRow: { flexDirection: "row", gap: 6, marginBottom: 3, alignItems: "center" },
  stepNum: { fontSize: 8, color: "#888", width: 14 },
  stepPriority: { fontSize: 7, backgroundColor: "#eee", borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1 },
  stepText: { fontSize: 8, flex: 1 },
  violRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0", paddingVertical: 3 },
  violCol1: { width: "22%" },
  violCol2: { width: "18%" },
  violCol3: { width: "12%" },
  violCol4: { width: "12%" },
  violCol5: { width: "10%" },
  violCol6: { width: "26%" },
  signOffRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e0e0e0", paddingVertical: 3 },
  soCol1: { width: "25%" },
  soCol2: { width: "15%" },
  soCol3: { width: "15%" },
  soCol4: { width: "15%" },
  soCol5: { width: "15%" },
  soCol6: { width: "15%" },
});

interface NextStep {
  id: string;
  text: string;
  priority: "High" | "Medium" | "Low";
}

interface COReportPDFProps {
  propertyAddress: string;
  block?: string | null;
  lot?: string | null;
  reportType: "CO" | "TCO";
  applications: COApplication[];
  violations: COViolation[];
  signOffs: COSignOff[];
  workTypeBreakdown: { workType: string; open: number; closed: number; total: number }[];
  previousSnapshot: ReportSnapshot | null;
  nextSteps: NextStep[];
  reportReceivedFrom: string;
  reportReceivedDate: string;
  reportNotes: string;
  requiredItemsMap: Record<string, RequiredItem[]>;
}

export function COReportPDF({
  propertyAddress, block, lot, reportType, applications, violations, signOffs,
  workTypeBreakdown, previousSnapshot, nextSteps, reportReceivedFrom, reportReceivedDate,
  reportNotes, requiredItemsMap,
}: COReportPDFProps) {
  const totalWorkItems = workTypeBreakdown.reduce((s, r) => s + r.total, 0);
  const totalClosed = workTypeBreakdown.reduce((s, r) => s + r.closed, 0);
  const totalOpen = totalWorkItems - totalClosed;
  const overallPct = totalWorkItems > 0 ? Math.round((totalClosed / totalWorkItems) * 100) : 0;
  const estMonths = Math.ceil(totalOpen / 40);
  const activeViols = violations.filter(v => v.status !== "Resolved" && v.status !== "Dismissed").length;
  const resolvedViols = violations.length - activeViols;
  const displaySignOffs = reportType === "TCO" ? signOffs.filter(so => so.tcoRequired) : signOffs;
  const pendingSignOffs = displaySignOffs.filter(so => so.status !== "Signed Off");
  const openApps = applications.filter(a => a.status !== "Signed Off");
  const highPenaltyViols = violations.filter(v => (v.penalty || 0) >= 2500 && v.status !== "Resolved" && v.status !== "Dismissed");

  const openAppDelta = previousSnapshot ? (totalOpen - previousSnapshot.openApps) : null;
  const closedAppDelta = previousSnapshot ? (totalClosed - previousSnapshot.closedApps) : null;
  const violDelta = previousSnapshot ? (activeViols - previousSnapshot.activeViols) : null;

  const fmtDelta = (v: number | null) => {
    if (v === null || v === 0) return "";
    return v > 0 ? `▲ ${v}` : `▼ ${Math.abs(v)}`;
  };

  const now = format(new Date(), "MMMM d, yyyy 'at' h:mm a");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>{reportType === "TCO" ? "Temporary " : ""}Certificate of Occupancy Status Report</Text>
          <Text style={s.subtitle}>{propertyAddress}{block ? ` · Block ${block}` : ""}{lot ? ` · Lot ${lot}` : ""}</Text>
          <View style={s.metaRow}>
            <Text>Report Date: {now}</Text>
            {reportReceivedFrom && <Text>Requested By: {reportReceivedFrom}</Text>}
            {reportReceivedDate && <Text>Received: {format(new Date(reportReceivedDate), "MMM d, yyyy")}</Text>}
          </View>
          {reportNotes ? <Text style={{ fontSize: 8, color: "#666", marginTop: 4 }}>Notes: {reportNotes}</Text> : null}
        </View>

        {/* Delta Cards */}
        <View style={s.deltaCards}>
          <View style={s.deltaCard}>
            <Text style={s.deltaLabel}>Open Apps</Text>
            <Text style={s.deltaValue}>{totalOpen.toLocaleString()}</Text>
            {openAppDelta !== null && openAppDelta !== 0 && (
              <Text style={[s.deltaChange, { color: openAppDelta < 0 ? "#16a34a" : "#dc2626" }]}>{fmtDelta(openAppDelta)}</Text>
            )}
          </View>
          <View style={s.deltaCard}>
            <Text style={s.deltaLabel}>Closed</Text>
            <Text style={s.deltaValue}>{totalClosed.toLocaleString()}</Text>
            {closedAppDelta !== null && closedAppDelta !== 0 && (
              <Text style={[s.deltaChange, { color: closedAppDelta > 0 ? "#16a34a" : "#dc2626" }]}>{fmtDelta(closedAppDelta)}</Text>
            )}
          </View>
          <View style={s.deltaCard}>
            <Text style={s.deltaLabel}>Active Viols</Text>
            <Text style={s.deltaValue}>{activeViols}</Text>
            {violDelta !== null && violDelta !== 0 && (
              <Text style={[s.deltaChange, { color: violDelta < 0 ? "#16a34a" : "#dc2626" }]}>{fmtDelta(violDelta)}</Text>
            )}
          </View>
          <View style={s.deltaCard}>
            <Text style={s.deltaLabel}>Overall</Text>
            <Text style={s.deltaValue}>{overallPct}%</Text>
            <Text style={s.deltaChange}>complete</Text>
          </View>
        </View>

        {/* Executive Summary */}
        <Text style={s.sectionTitle}>Executive Summary</Text>
        <View style={s.summaryBox}>
          <Text style={s.summaryText}>
            This property has {totalOpen.toLocaleString()} open applications and {activeViols} active violations. {totalClosed.toLocaleString()} applications have been closed ({overallPct}% complete).
          </Text>
          <Text style={s.summaryText}>
            Based on current close-out rate, estimated completion is ~{estMonths} months.
          </Text>
          {pendingSignOffs.length > 0 && (
            <Text style={s.summaryText}>
              {reportType === "TCO" ? "Life-safety sign-offs" : "Sign-offs"} still required: {pendingSignOffs.map(so => so.name).join(", ")}.
            </Text>
          )}
          {highPenaltyViols.length > 0 && (
            <Text style={[s.summaryText, { color: "#dc2626" }]}>
              ⚠ {highPenaltyViols.length} violations have penalties exceeding $2,500.
            </Text>
          )}
        </View>

        {/* Sign-Offs Table */}
        <Text style={s.sectionTitle}>{reportType === "TCO" ? "TCO " : ""}Required Sign-Offs</Text>
        <View style={s.headerRow}>
          <Text style={[s.headerText, s.soCol1]}>Sign-Off</Text>
          <Text style={[s.headerText, s.soCol2]}>Category</Text>
          <Text style={[s.headerText, s.soCol3]}>Status</Text>
          <Text style={[s.headerText, s.soCol4]}>Date</Text>
          <Text style={[s.headerText, s.soCol5]}>Expires</Text>
          <Text style={[s.headerText, s.soCol6]}>Valid</Text>
        </View>
        {displaySignOffs.map(so => {
          const inspExpired = so.date && so.status === "Signed Off" && (() => {
            const d = new Date(so.date);
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - 18);
            return d < cutoff;
          })();
          return (
            <View key={so.name} style={s.signOffRow}>
              <Text style={[s.cellText, s.soCol1]}>{so.name}</Text>
              <Text style={[s.cellText, s.soCol2]}>{so.category || "general"}</Text>
              <Text style={[s.cellText, s.soCol3]}>{so.status}</Text>
              <Text style={[s.cellText, s.soCol4]}>{so.date || "—"}</Text>
              <Text style={[s.cellText, s.soCol5]}>{so.expirationDate || "—"}</Text>
              <Text style={[s.cellText, s.soCol6, inspExpired ? { color: "#dc2626" } : {}]}>
                {so.status === "Signed Off" ? (inspExpired ? "EXPIRED" : "✓ Valid") : "N/A"}
              </Text>
            </View>
          );
        })}

        {/* Work Type Breakdown */}
        <Text style={s.sectionTitle}>Applications by Work Type</Text>
        <View style={s.headerRow}>
          <Text style={[s.headerText, { width: "25%" }]}>Work Type</Text>
          <Text style={[s.headerText, { width: "20%", textAlign: "right" }]}>Open</Text>
          <Text style={[s.headerText, { width: "20%", textAlign: "right" }]}>Closed</Text>
          <Text style={[s.headerText, { width: "20%", textAlign: "right" }]}>Total</Text>
          <Text style={[s.headerText, { width: "15%", textAlign: "right" }]}>%</Text>
        </View>
        {workTypeBreakdown.map(row => (
          <View key={row.workType} style={s.row}>
            <Text style={[s.cellText, { width: "25%" }]}>{row.workType} — {WORK_TYPE_LABELS[row.workType] || row.workType}</Text>
            <Text style={[s.cellText, { width: "20%", textAlign: "right" }]}>{row.open}</Text>
            <Text style={[s.cellText, { width: "20%", textAlign: "right" }]}>{row.closed}</Text>
            <Text style={[s.cellText, { width: "20%", textAlign: "right" }]}>{row.total}</Text>
            <Text style={[s.cellText, { width: "15%", textAlign: "right" }]}>{Math.round((row.closed / row.total) * 100)}%</Text>
          </View>
        ))}

        <View style={s.footer}>
          <Text>Prepared via CitiSignal · {now}</Text>
          <Text>Data sourced from NYC Open Data</Text>
        </View>
      </Page>

      {/* Page 2: Open Applications with Required Items */}
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Open Applications Detail ({openApps.length})</Text>
        <Text style={{ fontSize: 8, color: "#666", marginBottom: 12 }}>
          Every open application with BIS open items, required items, and action required.
        </Text>

        {openApps
          .sort((a, b) => {
            const p = { High: 0, Medium: 1, Low: 2 };
            return (p[a.priority] ?? 2) - (p[b.priority] ?? 2);
          })
          .map(app => {
            const openBis = app.bisOpenItems?.filter(i => !i.resolved) || [];
            const reqItems = requiredItemsMap[app.jobNum] || [];
            const outstandingReq = reqItems.filter(ri => !ri.dateReceived);
            const completedReq = reqItems.filter(ri => ri.dateReceived);
            return (
              <View key={app.jobNum} style={s.appCard} wrap={false}>
                <View style={s.appHeader}>
                  <Text style={s.appJobNum}>#{app.jobNum}</Text>
                  <Text style={s.appBadge}>{app.workType}</Text>
                  <Text style={s.appBadge}>{app.status}</Text>
                  <Text style={[s.appBadge, { backgroundColor: app.priority === "High" ? "#fee2e2" : app.priority === "Medium" ? "#fef3c7" : "#f0f0f0" }]}>{app.priority}</Text>
                </View>
                <Text style={s.appDesc}>{app.desc}</Text>
                <View style={s.appMeta}>
                  <Text>Tenant: {app.tenant || "—"}</Text>
                  <Text>Floor: {app.floor}</Text>
                  <Text>Filed: {format(new Date(app.fileDate), "MM/dd/yyyy")}</Text>
                </View>
                <View style={s.appAction}>
                  <Text><Text style={s.bold}>Action Required:</Text> {app.action}</Text>
                </View>

                {/* Open Required Items (from BIS data) */}
                {openBis.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={s.bisTitle}>⚠ {openBis.length} Open Required Item{openBis.length > 1 ? "s" : ""}</Text>
                    {openBis.map(item => (
                      <View key={item.id} style={s.bisItem}>
                        <Text style={{ fontSize: 7, fontWeight: "bold" }}>{item.description}</Text>
                        <Text style={s.bisText}>
                          From: {item.receivedFrom || "—"} · Requested: {item.dateRequested || "—"} · Received: {item.receivedDate || "Outstanding"}
                          {item.signOffRequired ? ` · Sign-Off: ${item.signOffRequired}` : ""}
                        </Text>
                        {item.notes && <Text style={[s.bisText, { fontStyle: "italic" }]}>{item.notes}</Text>}
                      </View>
                    ))}
                  </View>
                )}

                {/* Required Items (user-added, shown in BIS style) */}
                {reqItems.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={[s.bisTitle, { color: "#1d4ed8" }]}>
                      📋 {outstandingReq.length} Outstanding Required Item{outstandingReq.length !== 1 ? "s" : ""} · {completedReq.length}/{reqItems.length} received
                    </Text>
                    {outstandingReq.map(ri => (
                      <View key={ri.id} style={[s.bisItem, { borderLeftColor: "#2563eb" }]}>
                        <Text style={{ fontSize: 7, fontWeight: "bold" }}>{ri.name}</Text>
                        <Text style={s.bisText}>
                          From: {ri.receivedFrom || "—"} · Requested: {ri.dateRequested ? format(new Date(ri.dateRequested), "MM/dd/yyyy") : "—"} · Received: Outstanding
                        </Text>
                        {ri.notes && <Text style={[s.bisText, { fontStyle: "italic" }]}>{ri.notes}</Text>}
                      </View>
                    ))}
                    {completedReq.map(ri => (
                      <View key={ri.id} style={[s.bisItem, { borderLeftColor: "#16a34a" }]}>
                        <Text style={{ fontSize: 7, fontWeight: "bold", color: "#666" }}>{ri.name}</Text>
                        <Text style={s.bisText}>
                          From: {ri.receivedFrom || "—"} · Received: {ri.dateReceived ? format(new Date(ri.dateReceived), "MM/dd/yyyy") : "—"}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

        <View style={s.footer}>
          <Text>Prepared via CitiSignal · {now}</Text>
          <Text>Page 2 — Open Applications</Text>
        </View>
      </Page>

      {/* Page 3: Violations + Next Steps */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>Active Violations ({violations.filter(v => v.status !== "Resolved" && v.status !== "Dismissed").length})</Text>
        <View style={s.headerRow}>
          <Text style={[s.headerText, s.violCol1]}>Violation #</Text>
          <Text style={[s.headerText, s.violCol2]}>Type</Text>
          <Text style={[s.headerText, s.violCol3]}>Filed</Text>
          <Text style={[s.headerText, s.violCol4]}>Status</Text>
          <Text style={[s.headerText, s.violCol5]}>Penalty</Text>
          <Text style={[s.headerText, s.violCol6]}>Resolution Plan</Text>
        </View>
        {violations
          .filter(v => v.status !== "Resolved" && v.status !== "Dismissed")
          .map(v => (
            <View key={v.violationNum} style={s.violRow}>
              <Text style={[s.cellText, s.violCol1]}>{v.violationNum}</Text>
              <Text style={[s.cellText, s.violCol2]}>{v.type.replace("DOB VIOLATION - ", "")}</Text>
              <Text style={[s.cellText, s.violCol3]}>{format(new Date(v.fileDate), "MM/dd/yy")}</Text>
              <Text style={[s.cellText, s.violCol4]}>{v.status}</Text>
              <Text style={[s.cellText, s.violCol5]}>{v.penalty ? `$${v.penalty.toLocaleString()}` : "—"}</Text>
              <Text style={[s.cellText, s.violCol6]}>{v.resolutionPlan || "No plan"}</Text>
            </View>
          ))}

        {(() => {
          const total = violations
            .filter(v => v.status !== "Resolved" && v.status !== "Dismissed")
            .reduce((s, v) => s + (v.penalty || 0), 0);
          return total > 0 ? (
            <Text style={{ fontSize: 9, fontWeight: "bold", color: "#dc2626", marginTop: 6 }}>
              Total outstanding penalties: ${total.toLocaleString()}
            </Text>
          ) : null;
        })()}

        {/* Next Steps */}
        {nextSteps.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Recommended Next Steps</Text>
            {nextSteps.map((step, i) => (
              <View key={step.id} style={s.stepRow}>
                <Text style={s.stepNum}>{i + 1}.</Text>
                <Text style={s.stepPriority}>{step.priority}</Text>
                <Text style={s.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer}>
          <Text>Prepared via CitiSignal · {now}</Text>
          <Text>Data sourced from NYC Open Data — DOB Job Filings, DOB NOW Build, DOB Violations</Text>
        </View>
      </Page>
    </Document>
  );
}
