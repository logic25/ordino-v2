import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";

export interface DepositReceiptData {
  invoice_number: string;
  date: string;
  amount: number;
  payment_method: string;
  proposal_number: string;
  client_name: string;
  client_email?: string;
  project_name: string;
  project_number: string;
  company_name: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  companyBlock: { maxWidth: 250 },
  companyName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  companyDetail: { fontSize: 9, color: "#555", lineHeight: 1.4 },
  receiptLabel: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#333", textAlign: "right" },
  receiptMeta: { fontSize: 9, color: "#555", textAlign: "right", marginTop: 4, lineHeight: 1.5 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  sectionBlock: { width: "48%" },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#888", marginBottom: 4, textTransform: "uppercase" as any, letterSpacing: 0.5 },
  sectionText: { fontSize: 10, lineHeight: 1.5 },
  table: { marginTop: 10, marginBottom: 20 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ccc", paddingBottom: 4, marginBottom: 6 },
  tableHeaderCell: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#666", textTransform: "uppercase" as any },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  tableCell: { fontSize: 9, lineHeight: 1.4 },
  colDesc: { width: "70%" },
  colAmt: { width: "30%", textAlign: "right" },
  totalsBlock: { alignItems: "flex-end", marginTop: 10, marginBottom: 20 },
  totalDueRow: { flexDirection: "row", justifyContent: "flex-end", width: 220, paddingVertical: 6, borderTopWidth: 1.5, borderTopColor: "#333", marginTop: 4 },
  totalDueLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", width: 140 },
  totalDueValue: { fontSize: 12, fontFamily: "Helvetica-Bold", width: 80, textAlign: "right" },
  paymentSection: { backgroundColor: "#f7f7f7", padding: 14, borderRadius: 4, marginTop: 10, marginBottom: 20 },
  paymentLine: { fontSize: 9, color: "#444", lineHeight: 1.6 },
  noteBox: { backgroundColor: "#f0fdf4", padding: 14, borderRadius: 4, marginBottom: 20 },
  noteText: { fontSize: 9, color: "#166534", lineHeight: 1.6, textAlign: "center" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 8 },
  footerText: { fontSize: 8, color: "#888", textAlign: "center", lineHeight: 1.5 },
});

const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

export function DepositReceiptPDF({ data }: { data: DepositReceiptData }) {
  const receiptDate = data.date
    ? new Date(data.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{data.company_name || "Company"}</Text>
            {data.company_address ? <Text style={styles.companyDetail}>{data.company_address}</Text> : null}
            {data.company_phone ? <Text style={styles.companyDetail}>P: {data.company_phone}</Text> : null}
            {data.company_email ? <Text style={styles.companyDetail}>{data.company_email}</Text> : null}
          </View>
          <View>
            <Text style={styles.receiptLabel}>DEPOSIT RECEIPT</Text>
            <Text style={styles.receiptMeta}>#{data.invoice_number}</Text>
            <Text style={styles.receiptMeta}>Date: {receiptDate}</Text>
          </View>
        </View>

        {/* Received From + Project */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Received From</Text>
            <Text style={styles.sectionText}>{data.client_name}</Text>
            {data.client_email ? <Text style={styles.sectionText}>{data.client_email}</Text> : null}
          </View>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Project</Text>
            {data.project_number ? <Text style={styles.sectionText}>#{data.project_number}</Text> : null}
            <Text style={styles.sectionText}>{data.project_name || "—"}</Text>
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmt]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.colDesc]}>
              Deposit — Proposal #{data.proposal_number}
            </Text>
            <Text style={[styles.tableCell, styles.colAmt]}>{fmt(data.amount)}</Text>
          </View>
        </View>

        {/* Total */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalDueRow}>
            <Text style={styles.totalDueLabel}>TOTAL PAID</Text>
            <Text style={styles.totalDueValue}>{fmt(data.amount)}</Text>
          </View>
        </View>

        {/* Payment Info */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentLine}>Payment Method: {data.payment_method}</Text>
          <Text style={styles.paymentLine}>Reference: Proposal #{data.proposal_number}</Text>
        </View>

        {/* Note */}
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            This deposit will be applied as a credit toward future invoices for the above project.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {data.company_email ? `Questions? Contact us at ${data.company_email}` : "Thank you for your business!"}
            {data.company_phone ? ` | ${data.company_phone}` : ""}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
