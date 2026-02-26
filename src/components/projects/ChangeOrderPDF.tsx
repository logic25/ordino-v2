import {
  Document, Page, Text, View, StyleSheet, Image,
} from "@react-pdf/renderer";
import type { ChangeOrder, COLineItem } from "@/hooks/useChangeOrders";

interface ChangeOrderPDFProps {
  co: ChangeOrder;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  projectAddress?: string;
  projectNumber?: string;
  clientName?: string;
  signerName?: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  companyBlock: { maxWidth: 250 },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  companyDetail: { fontSize: 9, color: "#555", lineHeight: 1.4 },
  coLabel: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#333", textAlign: "right" },
  coMeta: { fontSize: 9, color: "#555", textAlign: "right", marginTop: 3, lineHeight: 1.5 },

  sectionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  sectionBlock: { width: "48%" },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#888", marginBottom: 3, textTransform: "uppercase" as any, letterSpacing: 0.5 },
  sectionText: { fontSize: 10, lineHeight: 1.5 },

  table: { marginTop: 10, marginBottom: 16 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ccc", paddingBottom: 4, marginBottom: 6 },
  tableHeaderCell: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#666", textTransform: "uppercase" as any },
  tableRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  tableCell: { fontSize: 9, lineHeight: 1.4 },
  colService: { width: "55%" },
  colAmount: { width: "45%", textAlign: "right" },

  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", marginRight: 20 },
  totalValue: { fontSize: 11, fontFamily: "Helvetica-Bold", width: 80, textAlign: "right" },

  reasonBlock: { marginTop: 16, marginBottom: 16 },
  reasonTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#666", marginBottom: 4 },
  reasonText: { fontSize: 10, lineHeight: 1.5, color: "#333" },

  sigBlock: { marginTop: 30, flexDirection: "row", justifyContent: "space-between" },
  sigColumn: { width: "45%" },
  sigLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#888", marginBottom: 4, textTransform: "uppercase" as any },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#333", height: 40, marginBottom: 4 },
  sigName: { fontSize: 9, color: "#333" },
  sigDate: { fontSize: 8, color: "#888", marginTop: 2 },
  sigImage: { height: 36, marginBottom: 4, objectFit: "contain" as any },

  footer: { position: "absolute", bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 6 },
  footerText: { fontSize: 8, color: "#888", textAlign: "center" },
});

const fmtCurrency = (n: number) =>
  `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US") : "";

export function ChangeOrderPDF({
  co,
  companyName,
  companyAddress,
  companyPhone,
  companyEmail,
  projectAddress,
  projectNumber,
  clientName,
  signerName,
}: ChangeOrderPDFProps) {
  const lineItems: COLineItem[] = Array.isArray(co.line_items) && co.line_items.length > 0
    ? co.line_items
    : (co.linked_service_names || []).map((name, i) => ({
        name,
        amount: i === 0 ? co.amount : 0,
        description: co.description || undefined,
      }));

  const isCredit = co.amount < 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{companyName || "Your Company"}</Text>
            {companyAddress && <Text style={styles.companyDetail}>{companyAddress}</Text>}
            {companyPhone && <Text style={styles.companyDetail}>P: {companyPhone}</Text>}
            {companyEmail && <Text style={styles.companyDetail}>{companyEmail}</Text>}
          </View>
          <View>
            <Text style={styles.coLabel}>CHANGE ORDER</Text>
            <Text style={styles.coMeta}>{co.co_number}</Text>
            <Text style={styles.coMeta}>Date: {fmtDate(co.created_at)}</Text>
            {co.requested_by && <Text style={styles.coMeta}>Requested by: {co.requested_by}</Text>}
          </View>
        </View>

        {/* Project / Client */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Project</Text>
            {projectNumber && <Text style={styles.sectionText}>{projectNumber}</Text>}
            {projectAddress && <Text style={styles.sectionText}>{projectAddress}</Text>}
          </View>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Client</Text>
            <Text style={styles.sectionText}>{clientName || "—"}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>{co.title}</Text>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colService]}>Service</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
          </View>
          {lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.colService}>
                <Text style={[styles.tableCell, { fontFamily: "Helvetica-Bold" }]}>{item.name}</Text>
                {item.description && (
                  <Text style={[styles.tableCell, { color: "#666", fontSize: 8 }]}>{item.description}</Text>
                )}
              </View>
              <Text style={[styles.tableCell, styles.colAmount]}>
                {isCredit ? `-${fmtCurrency(item.amount)}` : fmtCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{isCredit ? "Total Credit:" : "Total:"}</Text>
          <Text style={styles.totalValue}>
            {isCredit ? `-${fmtCurrency(co.amount)}` : fmtCurrency(co.amount)}
          </Text>
        </View>

        {/* Reason */}
        {co.reason && (
          <View style={styles.reasonBlock}>
            <Text style={styles.reasonTitle}>Reason for Change</Text>
            <Text style={styles.reasonText}>{co.reason}</Text>
          </View>
        )}

        {/* Signature Blocks */}
        <View style={styles.sigBlock}>
          <View style={styles.sigColumn}>
            <Text style={styles.sigLabel}>Company Authorization</Text>
            {co.internal_signature_data ? (
              <Image style={styles.sigImage} src={co.internal_signature_data} />
            ) : (
              <View style={styles.sigLine} />
            )}
            <Text style={styles.sigName}>{signerName || "Authorized Representative"}</Text>
            {co.internal_signed_at && <Text style={styles.sigDate}>Date: {fmtDate(co.internal_signed_at)}</Text>}
          </View>
          <View style={styles.sigColumn}>
            <Text style={styles.sigLabel}>Client Approval</Text>
            {co.client_signature_data ? (
              <Image style={styles.sigImage} src={co.client_signature_data} />
            ) : (
              <View style={styles.sigLine} />
            )}
            <Text style={styles.sigName}>{co.client_signer_name || "Client Representative"}</Text>
            {co.client_signed_at && <Text style={styles.sigDate}>Date: {fmtDate(co.client_signed_at)}</Text>}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {co.co_number} · {co.title} · Generated {new Date().toLocaleDateString("en-US")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
