import {
  Document, Page, Text, View, StyleSheet, Image, Link,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import type { Rfp } from "@/hooks/useRfps";

/* ── Brand palette ── */
const C = {
  accent: "#b5cc18",
  charcoal: "#1a1a1a",
  text: "#333333",
  secondary: "#888888",
  rule: "#e0e0e0",
  bg: "#f8f8f8",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: C.text, backgroundColor: C.white },
  // Header
  logoImg: { maxWidth: 200, maxHeight: 48 },
  companyNameFallback: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.charcoal, letterSpacing: -0.5 },
  accentBar: { height: 3, backgroundColor: C.accent, marginTop: 16 },
  // Title
  titleBlock: { marginTop: 20 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.charcoal, letterSpacing: -0.3, lineHeight: 1.3 },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  pill: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.charcoal, backgroundColor: C.bg, borderWidth: 0.5, borderColor: C.rule, borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3, letterSpacing: 0.5, textTransform: "uppercase" as any },
  // Section heading
  sectionHeading: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.secondary, letterSpacing: 1.2, textTransform: "uppercase" as any, marginTop: 24, marginBottom: 6 },
  divider: { height: 0.5, backgroundColor: C.rule, marginBottom: 10 },
  // Body
  bodyText: { fontSize: 10, color: C.text, lineHeight: 1.7, marginBottom: 6 },
  bodyTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.charcoal, marginBottom: 4 },
  // Card
  card: { borderWidth: 0.5, borderColor: C.rule, borderRadius: 6, padding: 12, marginBottom: 8 },
  cardTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.charcoal, letterSpacing: -0.2 },
  cardMeta: { fontSize: 9, color: C.secondary, marginTop: 3 },
  cardBody: { fontSize: 10, color: C.text, lineHeight: 1.6, marginTop: 6 },
  // Table
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.rule },
  tableHeader: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.secondary, letterSpacing: 0.8, textTransform: "uppercase" as any, padding: 8 },
  tableCell: { fontSize: 10, color: C.text, padding: 8 },
  tableCellBold: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.charcoal, padding: 8 },
  // Info grid
  infoRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.bg },
  infoLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.secondary, letterSpacing: 0.8, textTransform: "uppercase" as any },
  infoValue: { fontSize: 11, color: C.charcoal, fontFamily: "Helvetica-Bold", marginTop: 2 },
  infoCell: { width: "50%", padding: 10 },
  // Reference box
  refBox: { backgroundColor: C.bg, borderWidth: 0.5, borderColor: C.rule, borderRadius: 4, padding: 8, marginTop: 6 },
  refText: { fontSize: 9, color: C.text },
  // Footer
  footer: { position: "absolute", bottom: 28, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 6 },
  footerText: { fontSize: 7, color: C.secondary, textAlign: "center" },
});

/* ── Types ── */
export interface RfpPdfData {
  rfp: Rfp | null;
  sections: string[];
  companyInfo: any;
  staffBios: any[];
  notableProjects: any[];
  narratives: any[];
  firmHistory: any[];
  pricing: any;
  certs: any[];
  coverLetter?: string;
  logoUrl?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
}

/* ── Section heading ── */
function SectionHeading({ title }: { title: string }) {
  return (
    <>
      <Text style={s.sectionHeading}>{title}</Text>
      <View style={s.divider} />
    </>
  );
}

/* ── Section renderers ── */

function CoverLetterSection({ text }: { text: string }) {
  return (
    <View>
      <SectionHeading title="Cover Letter" />
      <Text style={s.bodyText}>{text}</Text>
    </View>
  );
}

function FirmOverviewSection({ firmHistory }: { firmHistory: any[] }) {
  if (!firmHistory.length) return null;
  return (
    <View>
      <SectionHeading title="About Our Firm" />
      {firmHistory.map((item, i) => {
        const txt = (item.content as any)?.text || "";
        return (
          <View key={i} style={{ marginBottom: 10 }}>
            {item.title && <Text style={s.bodyTitle}>{item.title}</Text>}
            <Text style={s.bodyText}>{txt}</Text>
          </View>
        );
      })}
    </View>
  );
}

function CompanyInfoSection({ data }: { data: any }) {
  const content = data?.content as Record<string, any> | undefined;
  if (!content) return null;
  const fields = [
    { label: "Legal Name", value: content.legal_name },
    { label: "Address", value: content.address },
    { label: "Phone", value: content.phone },
    { label: "Email", value: content.email },
    { label: "Tax ID", value: content.tax_id },
    { label: "Founded", value: content.founded_year },
    { label: "Employees", value: content.staff_count },
    { label: "Website", value: content.website },
  ].filter((f) => f.value);
  if (!fields.length) return null;

  const pairs: { label: string; value: any }[][] = [];
  for (let i = 0; i < fields.length; i += 2) {
    pairs.push(fields.slice(i, i + 2));
  }

  return (
    <View>
      <SectionHeading title="Company Details" />
      <View style={{ borderWidth: 0.5, borderColor: C.rule, borderRadius: 6 }}>
        {pairs.map((pair, i) => (
          <View key={i} style={s.infoRow}>
            {pair.map((f, j) => (
              <View key={j} style={s.infoCell}>
                <Text style={s.infoLabel}>{f.label}</Text>
                <Text style={s.infoValue}>{String(f.value)}</Text>
              </View>
            ))}
            {pair.length === 1 && <View style={s.infoCell} />}
          </View>
        ))}
      </View>
    </View>
  );
}

function StaffBiosSection({ bios }: { bios: any[] }) {
  if (!bios.length) return null;
  return (
    <View>
      <SectionHeading title="Key Personnel" />
      {bios.map((item, i) => {
        const c = item.content as any;
        const meta: string[] = [];
        if (c.title) meta.push(c.title);
        if (c.years_experience) meta.push(`${c.years_experience} years`);
        if (c.hourly_rate) meta.push(`$${Number(c.hourly_rate).toLocaleString()}/hr`);
        return (
          <View key={i} style={s.card}>
            <Text style={s.cardTitle}>{c.name || "—"}</Text>
            {meta.length > 0 && <Text style={s.cardMeta}>{meta.join(" · ")}</Text>}
            {c.bio && <Text style={s.cardBody}>{c.bio}</Text>}
          </View>
        );
      })}
    </View>
  );
}

function NotableProjectsSection({ projects }: { projects: any[] }) {
  if (!projects.length) return null;
  return (
    <View>
      <SectionHeading title="Notable Projects & References" />
      {projects.map((proj, i) => {
        const props = proj.properties as any;
        const isSheet = proj._isSheet;
        const title = isSheet ? proj._title : (props?.address || "Unknown");
        const completionDate = proj.completion_date;

        const metaParts: string[] = [];
        if (props?.borough && !isSheet) metaParts.push(props.borough);
        if (props?.address && isSheet) metaParts.push(props.address);
        if (proj.client_name) metaParts.push(proj.client_name);
        if (proj.estimated_value) metaParts.push(`$${proj.estimated_value.toLocaleString()}`);
        if (proj.application_type) metaParts.push(proj.application_type);
        if (completionDate) metaParts.push(`Completed ${format(new Date(completionDate), "MMM yyyy")}`);

        return (
          <View key={i} style={s.card}>
            <Text style={s.cardTitle}>{title}</Text>
            {metaParts.length > 0 && <Text style={s.cardMeta}>{metaParts.join(" · ")}</Text>}
            {proj.description && <Text style={s.cardBody}>{proj.description}</Text>}
            {proj.reference_contact_name && (
              <View style={s.refBox}>
                <Text style={s.refText}>
                  Reference: {proj.reference_contact_name}
                  {proj.reference_contact_title ? `, ${proj.reference_contact_title}` : ""}
                  {proj.reference_contact_phone ? ` — ${proj.reference_contact_phone}` : ""}
                  {proj.reference_contact_email ? ` — ${proj.reference_contact_email}` : ""}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function NarrativesSection({ narratives }: { narratives: any[] }) {
  if (!narratives.length) return null;
  return (
    <View>
      <SectionHeading title="Narratives & Approach" />
      {narratives.map((item, i) => {
        const text = (item.content as any)?.text || "";
        return (
          <View key={i} style={{ marginBottom: 12 }}>
            <Text style={s.bodyTitle}>{item.title}</Text>
            <Text style={s.bodyText}>{text}</Text>
          </View>
        );
      })}
    </View>
  );
}

function PricingSection({ data }: { data: any }) {
  const content = data?.content as any;
  if (!content?.labor_classifications?.length) return null;
  return (
    <View>
      <SectionHeading title="Pricing / Rate Schedule" />
      <View style={{ borderWidth: 0.5, borderColor: C.rule, borderRadius: 6 }}>
        {/* Header row */}
        <View style={[s.tableRow, { backgroundColor: C.bg }]}>
          <Text style={[s.tableHeader, { width: "40%" }]}>Classification</Text>
          <Text style={[s.tableHeader, { width: "20%", textAlign: "right" }]}>Regular</Text>
          <Text style={[s.tableHeader, { width: "20%", textAlign: "right" }]}>Overtime</Text>
          <Text style={[s.tableHeader, { width: "20%", textAlign: "right" }]}>Double Time</Text>
        </View>
        {content.labor_classifications.map((lc: any, i: number) => (
          <View key={i} style={[s.tableRow, i % 2 === 0 ? {} : { backgroundColor: C.bg }]}>
            <Text style={[s.tableCellBold, { width: "40%" }]}>{lc.title}</Text>
            <Text style={[s.tableCell, { width: "20%", textAlign: "right" }]}>${Number(lc.regular).toLocaleString()}</Text>
            <Text style={[s.tableCell, { width: "20%", textAlign: "right" }]}>${Number(lc.overtime).toLocaleString()}</Text>
            <Text style={[s.tableCell, { width: "20%", textAlign: "right" }]}>${Number(lc.doubletime).toLocaleString()}</Text>
          </View>
        ))}
        {content.annual_escalation && (
          <View style={{ padding: 8, borderTopWidth: 0.5, borderTopColor: C.rule }}>
            <Text style={{ fontSize: 9, color: C.secondary }}>
              Annual Escalation: {(content.annual_escalation * 100).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function CertsSection({ certs }: { certs: any[] }) {
  if (!certs.length) return null;
  return (
    <View>
      <SectionHeading title="Certifications & Licenses" />
      {certs.map((item, i) => {
        const c = item.content as any;
        const expiry = c.expiration_date ? ` · Exp: ${format(new Date(c.expiration_date), "MMM yyyy")}` : "";
        return (
          <View key={i} style={s.card}>
            <Text style={s.cardTitle}>{item.title}</Text>
            <Text style={s.cardMeta}>{c.cert_type} #{c.cert_number} · {c.issuing_agency}{expiry}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* ── Main PDF Document ── */

export function RfpResponsePDF({ data }: { data: RfpPdfData }) {
  const { rfp, sections, companyInfo, staffBios, notableProjects, narratives, firmHistory, pricing, certs, coverLetter, logoUrl, companyName, companyAddress, companyPhone, companyEmail, companyWebsite } = data;

  const pills: string[] = [];
  if (rfp?.rfp_number) pills.push(`RFP #${rfp.rfp_number}`);
  if (rfp?.agency) pills.push(rfp.agency);
  if (rfp?.due_date) pills.push(`Due ${format(new Date(rfp.due_date), "MMM d, yyyy")}`);

  const footerParts: string[] = [];
  if (companyName) footerParts.push(companyName);
  if (companyAddress) footerParts.push(companyAddress);
  if (companyPhone) footerParts.push(companyPhone);
  if (companyEmail) footerParts.push(companyEmail);
  if (companyWebsite) footerParts.push(companyWebsite.replace(/^https?:\/\//, ""));

  const sectionMap: Record<string, React.ReactNode> = {
    cover_letter: coverLetter ? <CoverLetterSection text={coverLetter} /> : null,
    firm_overview: <FirmOverviewSection firmHistory={firmHistory} />,
    company_info: <CompanyInfoSection data={companyInfo} />,
    staff_bios: <StaffBiosSection bios={staffBios} />,
    org_chart: null,
    notable_projects: <NotableProjectsSection projects={notableProjects} />,
    narratives: <NarrativesSection narratives={narratives} />,
    pricing: <PricingSection data={pricing} />,
    certifications: <CertsSection certs={certs} />,
  };

  return (
    <Document>
      <Page size="LETTER" style={s.page} wrap>
        {/* Logo */}
        {logoUrl ? (
          <Image src={logoUrl} style={s.logoImg} />
        ) : companyName ? (
          <Text style={s.companyNameFallback}>{companyName}</Text>
        ) : null}

        {/* Accent bar */}
        <View style={s.accentBar} />

        {/* Title */}
        <View style={s.titleBlock}>
          <Text style={s.title}>{rfp?.title || "RFP Response"}</Text>
          {pills.length > 0 && (
            <View style={s.pillRow}>
              {pills.map((p, i) => (
                <Text key={i} style={s.pill}>{p}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Content sections in order */}
        {sections.map((sec) => {
          const node = sectionMap[sec];
          return node ? <View key={sec}>{node}</View> : null;
        })}

        {/* Footer */}
        {footerParts.length > 0 && (
          <View style={s.footer}>
            <Text style={s.footerText}>{footerParts.join("  ·  ")}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

/** Generate a PDF blob for an RFP response */
export async function generateRfpPdfBlob(data: RfpPdfData): Promise<Blob> {
  const { pdf } = await import("@react-pdf/renderer");
  const { getLogoDataUrl } = await import("@/utils/logoToDataUrl");
  const resolvedLogo = await getLogoDataUrl(data.logoUrl || "");
  const blob = await pdf(
    <RfpResponsePDF data={{ ...data, logoUrl: resolvedLogo }} />
  ).toBlob();
  return blob;
}
