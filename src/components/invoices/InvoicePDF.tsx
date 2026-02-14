import {
  Document, Page, Text, View, StyleSheet, Font,
} from "@react-pdf/renderer";
import type { InvoiceWithRelations, LineItem } from "@/hooks/useInvoices";
import type { CompanySettings } from "@/hooks/useCompanySettings";

interface InvoicePDFProps {
  invoice: InvoiceWithRelations;
  companyName?: string;
  settings?: CompanySettings;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  companyBlock: { maxWidth: 250 },
  companyName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  companyDetail: { fontSize: 9, color: "#555", lineHeight: 1.4 },
  invoiceLabel: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#333", textAlign: "right" },
  invoiceMeta: { fontSize: 9, color: "#555", textAlign: "right", marginTop: 4, lineHeight: 1.5 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  sectionBlock: { width: "48%" },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#888", marginBottom: 4, textTransform: "uppercase" as any, letterSpacing: 0.5 },
  sectionText: { fontSize: 10, lineHeight: 1.5 },
  table: { marginTop: 10, marginBottom: 20 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ccc", paddingBottom: 4, marginBottom: 6 },
  tableHeaderCell: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#666", textTransform: "uppercase" as any },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  tableCell: { fontSize: 9, lineHeight: 1.4 },
  colDesc: { width: "50%" },
  colQty: { width: "12%", textAlign: "center" },
  colRate: { width: "19%", textAlign: "right" },
  colAmt: { width: "19%", textAlign: "right" },
  totalsBlock: { alignItems: "flex-end", marginTop: 10, marginBottom: 20 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", width: 220, paddingVertical: 2 },
  totalLabel: { fontSize: 10, width: 140 },
  totalValue: { fontSize: 10, fontFamily: "Helvetica-Bold", width: 80, textAlign: "right" },
  totalDueRow: { flexDirection: "row", justifyContent: "flex-end", width: 220, paddingVertical: 6, borderTopWidth: 1.5, borderTopColor: "#333", marginTop: 4 },
  totalDueLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", width: 140 },
  totalDueValue: { fontSize: 12, fontFamily: "Helvetica-Bold", width: 80, textAlign: "right" },
  paymentSection: { backgroundColor: "#f7f7f7", padding: 14, borderRadius: 4, marginTop: 10, marginBottom: 20 },
  paymentTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  paymentLine: { fontSize: 9, color: "#444", lineHeight: 1.6 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 8 },
  footerText: { fontSize: 8, color: "#888", textAlign: "center", lineHeight: 1.5 },
});

const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

export function InvoicePDF({ invoice, companyName, settings }: InvoicePDFProps) {
  const lineItems: LineItem[] = Array.isArray(invoice.line_items) ? invoice.line_items as any : [];
  const contact = invoice.billed_to_contact;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{companyName || "Your Company"}</Text>
            {settings?.company_address && <Text style={styles.companyDetail}>{settings.company_address}</Text>}
            {settings?.company_phone && <Text style={styles.companyDetail}>P: {settings.company_phone}</Text>}
            {settings?.company_fax && <Text style={styles.companyDetail}>F: {settings.company_fax}</Text>}
            {settings?.company_email && <Text style={styles.companyDetail}>{settings.company_email}</Text>}
            {settings?.company_website && <Text style={styles.companyDetail}>{settings.company_website}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>#{invoice.invoice_number}</Text>
            <Text style={styles.invoiceMeta}>
              Date: {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString("en-US") : "—"}
            </Text>
            {invoice.due_date && (
              <Text style={styles.invoiceMeta}>
                Due: {new Date(invoice.due_date).toLocaleDateString("en-US")}
              </Text>
            )}
          </View>
        </View>

        {/* Bill To + Project */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            {contact ? (
              <>
                <Text style={styles.sectionText}>{contact.name}</Text>
                {(contact as any).title && <Text style={styles.sectionText}>{(contact as any).title}</Text>}
                {(contact as any).company_name && <Text style={styles.sectionText}>{(contact as any).company_name}</Text>}
                {contact.email && <Text style={styles.sectionText}>{contact.email}</Text>}
                {contact.phone && <Text style={styles.sectionText}>{contact.phone}</Text>}
              </>
            ) : (
              <>
                <Text style={styles.sectionText}>{invoice.clients?.name || "—"}</Text>
                {invoice.clients?.email && <Text style={styles.sectionText}>{invoice.clients.email}</Text>}
              </>
            )}
          </View>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Project</Text>
            <Text style={styles.sectionText}>
              {invoice.projects?.project_number ? `#${invoice.projects.project_number}` : ""}
            </Text>
            <Text style={styles.sectionText}>{invoice.projects?.name || "—"}</Text>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colRate]}>Rate</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmt]}>Amount</Text>
          </View>
          {lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colDesc]}>{item.description}</Text>
              <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.colRate]}>{fmt(item.rate)}</Text>
              <Text style={[styles.tableCell, styles.colAmt]}>{fmt(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{fmt(Number(invoice.subtotal))}</Text>
          </View>
          {Number(invoice.retainer_applied) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Retainer Applied</Text>
              <Text style={styles.totalValue}>-{fmt(Number(invoice.retainer_applied))}</Text>
            </View>
          )}
          <View style={styles.totalDueRow}>
            <Text style={styles.totalDueLabel}>AMOUNT DUE</Text>
            <Text style={styles.totalDueValue}>{fmt(Number(invoice.total_due))}</Text>
          </View>
        </View>

        {/* Payment Terms */}
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 9, color: "#555" }}>
            Payment Terms: {invoice.payment_terms || "Net 30"}
          </Text>
        </View>

        {/* Payment Instructions */}
        {(settings?.payment_check_address || settings?.payment_wire_bank_name || settings?.payment_zelle_id || settings?.payment_cc_enabled) && (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Payment Options</Text>
            {settings.payment_check_address && (
              <Text style={styles.paymentLine}>Check: Mail to {settings.payment_check_address}</Text>
            )}
            {settings.payment_wire_bank_name && (
              <>
                <Text style={styles.paymentLine}>Wire Transfer:</Text>
                <Text style={styles.paymentLine}>  Bank: {settings.payment_wire_bank_name}</Text>
                {settings.payment_wire_routing && (
                  <Text style={styles.paymentLine}>  Routing: {settings.payment_wire_routing}</Text>
                )}
                {settings.payment_wire_account && (
                  <Text style={styles.paymentLine}>  Account: {settings.payment_wire_account}</Text>
                )}
              </>
            )}
            {settings.payment_zelle_id && (
              <Text style={styles.paymentLine}>Zelle: {settings.payment_zelle_id}</Text>
            )}
            {settings.payment_cc_enabled && settings.payment_cc_url && (
              <Text style={styles.paymentLine}>Credit Card: {settings.payment_cc_url}</Text>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {settings?.company_email ? `Questions? Contact us at ${settings.company_email}` : "Thank you for your business!"}
            {settings?.company_phone ? ` | ${settings.company_phone}` : ""}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
