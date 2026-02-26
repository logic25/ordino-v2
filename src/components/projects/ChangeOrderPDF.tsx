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
  companyWebsite?: string;
  companyFax?: string;
  projectAddress?: string;
  projectNumber?: string;
  clientName?: string;
  signerName?: string;
}

/* ── Palette matching Proposal ─────────────────────── */
const amber = "#E89A1D";   // hsl(38, 92%, 50%)
const charcoal = "#1c2127";
const slate = "#64748b";
const lightBg = "#f8f9fa";
const borderColor = "#e2e8f0";

const s = StyleSheet.create({
  page: { paddingBottom: 60, fontSize: 9.5, fontFamily: "Helvetica", color: charcoal },

  /* Header banner */
  headerBanner: { backgroundColor: charcoal, paddingHorizontal: 48, paddingTop: 32, paddingBottom: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
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

  /* Info cards row */
  infoRow: { flexDirection: "row", gap: 16, marginBottom: 24 },
  infoCard: { flex: 1, backgroundColor: lightBg, padding: "14px 18px" as any, borderRadius: 5, borderWidth: 1, borderColor },
  infoLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: slate, letterSpacing: 1.2, textTransform: "uppercase" as any, marginBottom: 6 },
  infoText: { fontSize: 9.5, marginBottom: 3 },
  infoBold: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 3 },

  /* Section heading */
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, marginTop: 8 },
  sectionBar: { width: 4, height: 22, backgroundColor: amber, borderRadius: 2 },
  sectionTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: charcoal },

  /* Line items */
  lineItem: { marginBottom: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: borderColor },
  lineItemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  lineItemName: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: charcoal },
  lineItemAmount: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: charcoal },
  lineItemDesc: { fontSize: 8.5, color: slate, lineHeight: 1.55, marginTop: 2 },

  /* Total bar */
  totalBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: charcoal, padding: "12px 18px" as any, borderRadius: 5, marginTop: 20 },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#ffffff", letterSpacing: 1, textTransform: "uppercase" as any },
  totalValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#ffffff" },

  /* Reason block */
  reasonBlock: { marginTop: 20 },
  reasonText: { fontSize: 9.5, color: "#475569", lineHeight: 1.55 },

  /* Signature section */
  sigSection: { marginTop: 32 },
  sigSubtext: { fontSize: 9, fontFamily: "Helvetica-Bold", color: slate, marginBottom: 4 },
  sigRow: { flexDirection: "row", gap: 16 },
  sigCard: { flex: 1, padding: "14px 18px" as any, backgroundColor: lightBg, borderRadius: 5, borderWidth: 1, borderColor },
  sigCardTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: charcoal, marginBottom: 20 },
  sigLine: { borderBottomWidth: 2, borderBottomColor: charcoal, height: 28, marginBottom: 4 },
  sigImage: { height: 26, objectFit: "contain" as any, marginBottom: 4 },
  sigMeta: { fontSize: 8, color: slate, marginTop: 3 },

  /* Footer */
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: borderColor, paddingTop: 8, alignItems: "center" },
  footerText: { fontSize: 7.5, color: slate, textAlign: "center" },
  footerAccent: { fontSize: 7.5, color: amber, textAlign: "center", marginTop: 2 },
});

const fmtCurrency = (n: number) =>
  `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

export function ChangeOrderPDF({
  co,
  companyName,
  companyAddress,
  companyPhone,
  companyEmail,
  companyWebsite,
  companyFax,
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
      <Page size="A4" style={s.page}>

        {/* ═══ Header Banner ═══ */}
        <View style={s.headerBanner}>
          <View>
            <Text style={s.companyName}>{companyName || "Your Company"}</Text>
            {companyAddress ? <Text style={s.headerDetail}>{companyAddress}</Text> : null}
            <Text style={s.headerDetail}>
              {companyPhone ? `Tel: ${companyPhone}` : ""}
              {companyFax ? `    Fax: ${companyFax}` : ""}
            </Text>
            {companyEmail ? <Text style={s.headerDetail}>{companyEmail}</Text> : null}
            {companyWebsite ? <Text style={s.headerDetail}>{companyWebsite}</Text> : null}
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerLabel}>Change Order</Text>
            <Text style={s.headerNumber}>{co.co_number}</Text>
            <Text style={s.headerMeta}>{fmtDate(co.created_at)}</Text>
            {co.requested_by ? <Text style={s.headerMeta}>Requested by: {co.requested_by}</Text> : null}
          </View>
        </View>

        {/* ═══ Amber accent bar ═══ */}
        <View style={s.accentBar} />

        {/* ═══ Body ═══ */}
        <View style={s.body}>

          {/* Project & Client info cards */}
          <View style={s.infoRow}>
            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Project Details</Text>
              {projectNumber ? <Text style={s.infoText}><Text style={{ fontFamily: "Helvetica-Bold" }}>Project:</Text> {projectNumber}</Text> : null}
              {projectAddress ? <Text style={s.infoText}><Text style={{ fontFamily: "Helvetica-Bold" }}>Address:</Text> {projectAddress}</Text> : null}
            </View>
            <View style={s.infoCard}>
              <Text style={s.infoLabel}>Client</Text>
              <Text style={s.infoBold}>{clientName || "—"}</Text>
            </View>
          </View>

          {/* Description / Title */}
          <View style={s.sectionHeading}>
            <View style={s.sectionBar} />
            <Text style={s.sectionTitle}>{co.title}</Text>
          </View>

          {/* Line Items */}
          {lineItems.map((item, i) => (
            <View key={i} style={[s.lineItem, i === lineItems.length - 1 ? { borderBottomWidth: 0 } : {}]}>
              <View style={s.lineItemHeader}>
                <Text style={s.lineItemName}>{item.name}</Text>
                <Text style={s.lineItemAmount}>
                  {isCredit ? `-${fmtCurrency(item.amount)}` : fmtCurrency(item.amount)}
                </Text>
              </View>
              {item.description ? <Text style={s.lineItemDesc}>{item.description}</Text> : null}
            </View>
          ))}

          {/* Total */}
          <View style={s.totalBar}>
            <Text style={s.totalLabel}>{isCredit ? "Total Credit" : "Total"}</Text>
            <Text style={s.totalValue}>
              {isCredit ? `-${fmtCurrency(co.amount)}` : fmtCurrency(co.amount)}
            </Text>
          </View>

          {/* Deposit Due */}
          {(co as any).deposit_percentage > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fffbeb", padding: "10px 18px" as any, borderRadius: 5, marginTop: 10, borderWidth: 1, borderColor: "#fde68a" }}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#92400e" }}>
                Deposit Due Upon Signing ({(co as any).deposit_percentage}%)
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: "#92400e" }}>
                {fmtCurrency(Math.abs(co.amount) * (co as any).deposit_percentage / 100)}
              </Text>
            </View>
          )}

          {/* Terms Reference */}
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 8, color: slate, lineHeight: 1.5, fontStyle: "italic" }}>
              By signing this Change Order, you acknowledge that all terms and conditions of the original proposal/contract remain in full effect. This Change Order modifies only the scope and fees described above.
            </Text>
          </View>

          {/* Reason */}
          {co.reason ? (
            <View style={s.reasonBlock}>
              <View style={[s.sectionHeading, { marginTop: 24 }]}>
                <View style={s.sectionBar} />
                <Text style={[s.sectionTitle, { fontSize: 12 }]}>Reason for Change</Text>
              </View>
              <Text style={s.reasonText}>{co.reason}</Text>
            </View>
          ) : null}

          {/* ═══ Signature Section ═══ */}
          <View style={s.sigSection}>
            <Text style={s.sigSubtext}>Please sign the designated space provided below and return a copy</Text>
            <View style={[s.sectionHeading, { marginBottom: 16 }]}>
              <View style={s.sectionBar} />
              <Text style={[s.sectionTitle, { fontSize: 11 }]}>Agreed to and accepted by</Text>
            </View>

            <View style={s.sigRow}>
              {/* Company */}
              <View style={s.sigCard}>
                <Text style={s.sigCardTitle}>{companyName || "Your Company"}</Text>
                {co.internal_signature_data ? (
                  <Image style={s.sigImage} src={co.internal_signature_data} />
                ) : (
                  <View style={s.sigLine} />
                )}
                <Text style={s.sigMeta}>By: {signerName || "Authorized Representative"}</Text>
                {co.internal_signed_at ? <Text style={s.sigMeta}>Date: {fmtDate(co.internal_signed_at)}</Text> : null}
              </View>

              {/* Client */}
              <View style={s.sigCard}>
                <Text style={s.sigCardTitle}>{clientName || "Client"}</Text>
                {co.client_signature_data ? (
                  <Image style={s.sigImage} src={co.client_signature_data} />
                ) : (
                  <View style={s.sigLine} />
                )}
                <Text style={s.sigMeta}>By: {co.client_signer_name || "Client Representative"}</Text>
                {co.client_signed_at ? <Text style={s.sigMeta}>Date: {fmtDate(co.client_signed_at)}</Text> : null}
              </View>
            </View>
          </View>
        </View>

        {/* ═══ Footer ═══ */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {companyAddress || ""}
            {companyPhone ? `  ·  Tel: ${companyPhone}` : ""}
            {companyEmail ? `  ·  ${companyEmail}` : ""}
          </Text>
          {companyWebsite ? <Text style={s.footerAccent}>{companyWebsite}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}
