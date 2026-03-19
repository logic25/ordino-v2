import {
  Document, Page, Text, View, StyleSheet, Image,
} from "@react-pdf/renderer";
import type { InvoiceWithRelations, LineItem } from "@/hooks/useInvoices";
import type { CompanySettings } from "@/hooks/useCompanySettings";

interface InvoicePDFProps {
  invoice: InvoiceWithRelations;
  companyName?: string;
  settings?: CompanySettings;
  logoUrl?: string;
}

/* ── Brand palette (matches ChangeOrder / Proposal) ── */
const amber = "hsl(65 69% 54%)";
const charcoal = "#1c2127";
const slate = "#64748b";
const lightBg = "#f8f9fa";
const borderColor = "#e2e8f0";

const s = StyleSheet.create({
  page: { paddingBottom: 60, fontSize: 9.5, fontFamily: "Helvetica", color: charcoal },

  /* Header banner */
  headerBanner: { backgroundColor: charcoal, paddingHorizontal: 48, paddingTop: 32, paddingBottom: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { maxHeight: 40, maxWidth: 160, objectFit: "contain" as any, marginBottom: 10 },
  companyName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#ffffff", marginBottom: 6, letterSpacing: -0.3 },
  headerDetail: { fontSize: 8.5, color: "#94a3b8", lineHeight: 1.55 },
  headerRight: { alignItems: "flex-end" },
  headerLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: amber, letterSpacing: 2, textTransform: "uppercase" as any, marginBottom: 3 },
  headerNumber: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#ffffff", letterSpacing: 0.3 },
  headerMeta: { fontSize: 8.5, color: "#94a3b8", marginTop: 5 },

  /* Accent bar */
  accentBar: { height: 4, backgroundColor: amber },

  /* Body */
  body: { paddingHorizontal: 48, paddingTop: 28, paddingBottom: 40 },

  /* Info cards */
  infoRow: { flexDirection: "row", gap: 16, marginBottom: 24 },
  infoCard: { flex: 1, backgroundColor: lightBg, padding: "14px 18px" as any, borderRadius: 5, borderWidth: 1, borderColor },
  infoLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: slate, letterSpacing: 1.2, textTransform: "uppercase" as any, marginBottom: 6 },
  infoText: { fontSize: 9.5, marginBottom: 3 },
  infoBold: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 3 },

  /* Section heading */
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, marginTop: 8 },
  sectionBar: { width: 4, height: 22, backgroundColor: amber, borderRadius: 2 },
  sectionTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: charcoal },

  /* Table */
  table: { marginTop: 10, marginBottom: 20 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: borderColor, paddingBottom: 6, marginBottom: 6 },
  tableHeaderCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: slate, textTransform: "uppercase" as any, letterSpacing: 1 },
  tableRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  tableCell: { fontSize: 9.5, lineHeight: 1.4 },
  colDesc: { width: "50%" },
  colQty: { width: "12%", textAlign: "center" },
  colRate: { width: "19%", textAlign: "right" },
  colAmt: { width: "19%", textAlign: "right" },

  /* Total bar */
  totalBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: charcoal, padding: "12px 18px" as any, borderRadius: 5, marginTop: 20 },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#ffffff", letterSpacing: 1, textTransform: "uppercase" as any },
  totalValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#ffffff" },

  /* Subtotal rows */
  totalsBlock: { alignItems: "flex-end", marginTop: 10, marginBottom: 6 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", width: 220, paddingVertical: 2 },
  totalRowLabel: { fontSize: 10, width: 140, color: slate },
  totalRowValue: { fontSize: 10, fontFamily: "Helvetica-Bold", width: 80, textAlign: "right" },

  /* Payment section */
  paymentSection: { backgroundColor: lightBg, padding: "14px 18px" as any, borderRadius: 5, marginTop: 16, borderWidth: 1, borderColor },
  paymentTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  paymentLine: { fontSize: 9, color: "#444", lineHeight: 1.6 },

  /* Footer */
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: borderColor, paddingTop: 8, alignItems: "center" },
  footerText: { fontSize: 7.5, color: slate, textAlign: "center" },
  footerAccent: { fontSize: 7.5, color: amber, textAlign: "center", marginTop: 2 },
});

const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

export function InvoicePDF({ invoice, companyName, settings, logoUrl }: InvoicePDFProps) {
  const lineItems: LineItem[] = Array.isArray(invoice.line_items) ? invoice.line_items as any : [];
  const contact = invoice.billed_to_contact;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ═══ Header Banner ═══ */}
        <View style={s.headerBanner}>
          <View>
            {logoUrl ? (
              <Image style={s.logo} src={logoUrl} />
            ) : (
              <Text style={s.companyName}>{companyName || "Your Company"}</Text>
            )}
            {logoUrl && <Text style={[s.companyName, { fontSize: 14 }]}>{companyName || "Your Company"}</Text>}
            {settings?.company_address && <Text style={s.headerDetail}>{settings.company_address}</Text>}
            <Text style={s.headerDetail}>
              {settings?.company_phone ? `Tel: ${settings.company_phone}` : ""}
              {settings?.company_fax ? `    Fax: ${settings.company_fax}` : ""}
            </Text>
            {settings?.company_email && <Text style={s.headerDetail}>{settings.company_email}</Text>}
            {settings?.company_website && <Text style={s.headerDetail}>{settings.company_website}</Text>}
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerLabel}>Invoice</Text>
            <Text style={s.headerNumber}>#{invoice.invoice_number}</Text>
            <Text style={s.headerMeta}>{fmtDate(invoice.created_at)}</Text>
            {invoice.due_date && <Text style={s.headerMeta}>Due: {fmtDate(invoice.due_date)}</Text>}
          </View>
        </View>

        {/* ═══ Amber accent bar ═══ */}
        <View style={s.accentBar} />

        {/* ═══ Body ═══ */}
        <View style={s.body}>

          {/* Bill To + Project info cards */}
          <View style={s.infoRow}>
            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Bill To</Text>
              {contact ? (
                <>
                  <Text style={s.infoBold}>{contact.name}</Text>
                  {(contact as any).title && <Text style={s.infoText}>{(contact as any).title}</Text>}
                  {(contact as any).company_name && <Text style={s.infoText}>{(contact as any).company_name}</Text>}
                  {contact.email && <Text style={s.infoText}>{contact.email}</Text>}
                  {contact.phone && <Text style={s.infoText}>{contact.phone}</Text>}
                </>
              ) : (
                <>
                  <Text style={s.infoBold}>{invoice.clients?.name || "—"}</Text>
                  {invoice.clients?.email && <Text style={s.infoText}>{invoice.clients.email}</Text>}
                </>
              )}
            </View>
            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Project</Text>
              {invoice.projects?.project_number && (
                <Text style={s.infoText}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Project:</Text> #{invoice.projects.project_number}
                </Text>
              )}
              <Text style={s.infoBold}>{invoice.projects?.name || "—"}</Text>
            </View>
          </View>

          {/* ═══ Line Items ═══ */}
          <View style={s.sectionHeading}>
            <View style={s.sectionBar} />
            <Text style={s.sectionTitle}>Line Items</Text>
          </View>

          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, s.colDesc]}>Description</Text>
              <Text style={[s.tableHeaderCell, s.colQty]}>Qty</Text>
              <Text style={[s.tableHeaderCell, s.colRate]}>Rate</Text>
              <Text style={[s.tableHeaderCell, s.colAmt]}>Amount</Text>
            </View>
            {lineItems.map((item, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={[s.tableCell, s.colDesc]}>{item.description}</Text>
                <Text style={[s.tableCell, s.colQty]}>{item.quantity}</Text>
                <Text style={[s.tableCell, s.colRate]}>{fmt(item.rate)}</Text>
                <Text style={[s.tableCell, s.colAmt]}>{fmt(item.amount)}</Text>
              </View>
            ))}
          </View>

          {/* Subtotal rows */}
          <View style={s.totalsBlock}>
            <View style={s.totalRow}>
              <Text style={s.totalRowLabel}>Subtotal</Text>
              <Text style={s.totalRowValue}>{fmt(Number(invoice.subtotal))}</Text>
            </View>
            {Number(invoice.retainer_applied) > 0 && (
              <View style={s.totalRow}>
                <Text style={s.totalRowLabel}>Deposit Applied</Text>
                <Text style={s.totalRowValue}>-{fmt(Number(invoice.retainer_applied))}</Text>
              </View>
            )}
          </View>

          {/* Total bar */}
          <View style={s.totalBar}>
            <Text style={s.totalLabel}>Amount Due</Text>
            <Text style={s.totalValue}>{fmt(Number(invoice.total_due))}</Text>
          </View>

          {/* Payment Terms */}
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 9, color: slate }}>
              Payment Terms: {invoice.payment_terms || "Net 30"}
            </Text>
          </View>

          {/* Payment Instructions */}
          {(settings?.payment_check_address || settings?.payment_wire_bank_name || settings?.payment_zelle_id || settings?.payment_cc_enabled) && (
            <View style={s.paymentSection}>
              <Text style={s.paymentTitle}>Payment Options</Text>
              {settings.payment_check_address && (
                <Text style={s.paymentLine}>Check: Mail to {settings.payment_check_address}</Text>
              )}
              {settings.payment_wire_bank_name && (
                <>
                  <Text style={s.paymentLine}>Wire Transfer:</Text>
                  <Text style={s.paymentLine}>  Bank: {settings.payment_wire_bank_name}</Text>
                  {settings.payment_wire_routing && (
                    <Text style={s.paymentLine}>  Routing: {settings.payment_wire_routing}</Text>
                  )}
                  {settings.payment_wire_account && (
                    <Text style={s.paymentLine}>  Account: {settings.payment_wire_account}</Text>
                  )}
                </>
              )}
              {settings.payment_zelle_id && (
                <Text style={s.paymentLine}>Zelle: {settings.payment_zelle_id}</Text>
              )}
              {settings.payment_cc_enabled && settings.payment_cc_url && (
                <Text style={s.paymentLine}>Credit Card: {settings.payment_cc_url}</Text>
              )}
            </View>
          )}
        </View>

        {/* ═══ Footer ═══ */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {settings?.company_address || ""}
            {settings?.company_phone ? `  ·  Tel: ${settings.company_phone}` : ""}
            {settings?.company_email ? `  ·  ${settings.company_email}` : ""}
          </Text>
          {settings?.company_website ? <Text style={s.footerAccent}>{settings.company_website}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}
