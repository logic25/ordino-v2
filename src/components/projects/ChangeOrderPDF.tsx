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
  logoUrl?: string;
  /** Original contract total from project services */
  originalContractTotal?: number;
  /** Sum of all previously approved COs (excluding this one) */
  previousCOsTotal?: number;
  /** Count of previously approved COs */
  previousCOsCount?: number;
}

/* ── Palette matching Proposal white-header style ─────── */
const brand = "#d7df23";
const charcoal = "#1e293b";
const slate = "#64748b";
const lightBg = "#f8fafc";
const borderColor = "#e2e8f0";
const muted = "#94a3b8";

const s = StyleSheet.create({
  page: { paddingBottom: 60, fontSize: 9.5, fontFamily: "Helvetica", color: charcoal },

  /* White header */
  headerWrap: { paddingHorizontal: 48, paddingTop: 32, paddingBottom: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { maxHeight: 48, maxWidth: 240, objectFit: "contain" as any, marginBottom: 8 },
  companyName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: charcoal, marginBottom: 4 },
  headerDetail: { fontSize: 8.5, color: muted, lineHeight: 1.55 },
  headerRight: { alignItems: "flex-end" },
  headerLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: muted, letterSpacing: 1.5, textTransform: "uppercase" as any, marginBottom: 2 },
  headerNumber: { fontSize: 18, fontFamily: "Helvetica-Bold", color: charcoal, letterSpacing: -0.3 },
  headerMeta: { fontSize: 8.5, color: muted, marginTop: 4 },

  /* Accent bar — matches proposal's 3px green line */
  accentBar: { height: 3, backgroundColor: brand, marginHorizontal: 48, marginTop: 14, marginBottom: 0 },

  /* Body */
  body: { paddingHorizontal: 48, paddingTop: 28, paddingBottom: 40 },

  /* Info cards row */
  infoRow: { flexDirection: "row", gap: 16, marginBottom: 24 },
  infoCard: { flex: 1, backgroundColor: lightBg, padding: "14px 18px" as any, borderRadius: 5, borderWidth: 1, borderColor },
  infoLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: muted, letterSpacing: 1.2, textTransform: "uppercase" as any, marginBottom: 6 },
  infoText: { fontSize: 9.5, marginBottom: 3 },
  infoBold: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 3 },

  /* Section heading */
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, marginTop: 8 },
  sectionBar: { width: 4, height: 22, backgroundColor: brand, borderRadius: 2 },
  sectionTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: charcoal },

  /* Line items */
  lineItem: { marginBottom: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: borderColor },
  lineItemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  lineItemName: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: charcoal },
  lineItemAmount: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: charcoal },
  lineItemDesc: { fontSize: 8.5, color: slate, lineHeight: 1.55, marginTop: 2 },

  /* Total bar */
  totalBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: lightBg, padding: "14px 18px" as any, borderRadius: 5, marginTop: 20, borderWidth: 1, borderColor },
  totalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: charcoal, letterSpacing: 0.5, textTransform: "uppercase" as any },
  totalValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: charcoal },

  /* Reason block */
  reasonBlock: { marginTop: 20 },
  reasonText: { fontSize: 9.5, color: "#475569", lineHeight: 1.55 },

  /* Contract summary */
  summarySection: { marginTop: 24 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 18 },
  summaryLabel: { fontSize: 9.5, color: slate },
  summaryValue: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: charcoal },
  summaryDivider: { borderBottomWidth: 1, borderBottomColor: borderColor, marginVertical: 2 },
  summaryTotalRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: charcoal, padding: "10px 18px" as any, borderRadius: 5, marginTop: 4 },
  summaryTotalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff", letterSpacing: 0.5, textTransform: "uppercase" as any },
  summaryTotalValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#ffffff" },

  /* Signature section — matching proposal style */
  sigSection: { marginTop: 32 },
  sigSubtext: { fontSize: 9, fontFamily: "Helvetica-Bold", color: slate, marginBottom: 4 },
  sigRow: { flexDirection: "row", gap: 32 },
  sigCard: { flex: 1, padding: "20px 24px" as any, backgroundColor: "#ffffff", borderRadius: 6, borderWidth: 1, borderColor },
  sigCardTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: charcoal, marginBottom: 16 },
  sigImageWrap: { borderBottomWidth: 1.5, borderBottomColor: charcoal, paddingBottom: 6, marginBottom: 6, minHeight: 56 },
  sigImage: { height: 56, objectFit: "contain" as any },
  sigLine: { borderBottomWidth: 1.5, borderBottomColor: charcoal, height: 56, marginBottom: 6 },
  sigMetaRow: { fontSize: 8.5, color: slate, marginTop: 4, lineHeight: 1.6 },
  sigMetaLabel: { fontFamily: "Helvetica-Bold" },

  /* Footer */
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: borderColor, paddingTop: 8, alignItems: "center" },
  footerText: { fontSize: 7.5, color: muted, textAlign: "center" },
  footerAccent: { fontSize: 7.5, color: brand, textAlign: "center", marginTop: 2 },
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
  logoUrl,
  originalContractTotal,
  previousCOsTotal,
  previousCOsCount,
}: ChangeOrderPDFProps) {
  const lineItems: COLineItem[] = Array.isArray(co.line_items) && co.line_items.length > 0
    ? co.line_items
    : (co.linked_service_names || []).map((name, i) => ({
        name,
        amount: i === 0 ? co.amount : 0,
        description: co.description || undefined,
      }));

  const isCredit = co.amount < 0;

  // Contract summary calculations
  const hasContractSummary = originalContractTotal != null && originalContractTotal > 0;
  const priorCOs = previousCOsTotal ?? 0;
  const priorCount = previousCOsCount ?? 0;
  const adjustedTotal = (originalContractTotal ?? 0) + priorCOs + co.amount;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ═══ White Header ═══ */}
        <View style={s.headerWrap}>
          <View>
            {logoUrl ? (
              <Image style={s.logo} src={logoUrl} />
            ) : null}
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

        {/* ═══ Brand accent bar ═══ */}
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

          {/* Section Title */}
          <View style={s.sectionHeading}>
            <View style={s.sectionBar} />
            <Text style={s.sectionTitle}>Change scope of work</Text>
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
              {item.work_types && item.work_types.length > 0 ? (
                <Text style={[s.lineItemDesc, { marginTop: 1 }]}>{item.work_types.join(", ")}</Text>
              ) : null}
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

          {/* ═══ Contract Balance Summary ═══ */}
          {hasContractSummary && (
            <View style={s.summarySection} wrap={false}>
              <View style={[s.sectionHeading, { marginBottom: 10 }]}>
                <View style={s.sectionBar} />
                <Text style={[s.sectionTitle, { fontSize: 12 }]}>Contract Summary</Text>
              </View>

              <View style={{ borderWidth: 1, borderColor, borderRadius: 5, overflow: "hidden" as any }}>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Original Contract</Text>
                  <Text style={s.summaryValue}>{fmtCurrency(originalContractTotal!)}</Text>
                </View>
                <View style={s.summaryDivider} />
                {priorCount > 0 && (
                  <>
                    <View style={s.summaryRow}>
                      <Text style={s.summaryLabel}>
                        Previous Change Orders ({priorCount})
                      </Text>
                      <Text style={s.summaryValue}>
                        {priorCOs >= 0 ? `+${fmtCurrency(priorCOs)}` : `-${fmtCurrency(priorCOs)}`}
                      </Text>
                    </View>
                    <View style={s.summaryDivider} />
                  </>
                )}
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>This Change Order ({co.co_number})</Text>
                  <Text style={[s.summaryValue, { color: isCredit ? "#dc2626" : "#16a34a" }]}>
                    {isCredit ? `-${fmtCurrency(co.amount)}` : `+${fmtCurrency(co.amount)}`}
                  </Text>
                </View>
              </View>

              <View style={s.summaryTotalRow}>
                <Text style={s.summaryTotalLabel}>Adjusted Contract Total</Text>
                <Text style={s.summaryTotalValue}>{fmtCurrency(adjustedTotal)}</Text>
              </View>
            </View>
          )}

          {/* Terms Reference */}
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 8, color: slate, lineHeight: 1.5, fontStyle: "italic" }}>
              By signing this Change Order, you acknowledge that all terms and conditions of the original proposal/contract remain in full effect. This Change Order modifies only the scope and fees described above.
            </Text>
          </View>


          {/* ═══ Signature Section — Matching Proposal Style ═══ */}
          <View style={s.sigSection} wrap={false}>
            <Text style={s.sigSubtext}>Please sign the designated space provided below and return a copy</Text>
            <View style={[s.sectionHeading, { marginBottom: 16 }]}>
              <View style={s.sectionBar} />
              <Text style={[s.sectionTitle, { fontSize: 11 }]}>Agreed to and accepted by</Text>
            </View>

            <View style={s.sigRow}>
              {/* Company */}
              <View style={s.sigCard}>
                <Text style={s.sigCardTitle}>{companyName || "Your Company"}</Text>
                <View style={s.sigImageWrap}>
                  {co.internal_signature_data ? (
                    <Image style={s.sigImage} src={co.internal_signature_data} />
                  ) : null}
                </View>
                <View style={s.sigMetaRow}>
                  <Text><Text style={s.sigMetaLabel}>By:</Text> {signerName || co.internal_signer_name || "—"}</Text>
                  {co.internal_signed_at ? <Text><Text style={s.sigMetaLabel}>Date:</Text> {fmtDate(co.internal_signed_at)}</Text> : null}
                </View>
              </View>

              {/* Client */}
              <View style={s.sigCard}>
                <Text style={s.sigCardTitle}>{clientName || "Client"}</Text>
                <View style={s.sigImageWrap}>
                  {co.client_signature_data ? (
                    <Image style={s.sigImage} src={co.client_signature_data} />
                  ) : null}
                </View>
                <View style={s.sigMetaRow}>
                  <Text><Text style={s.sigMetaLabel}>By:</Text> {co.client_signer_name || (co as any).recipient_name || "Client Representative"}</Text>
                  {co.client_signed_at ? <Text><Text style={s.sigMetaLabel}>Date:</Text> {fmtDate(co.client_signed_at)}</Text> : null}
                </View>
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
