import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { DemandLetterResult } from "@/hooks/useDemandLetter";

const charcoal = "#1c2127";
const slate = "#64748b";
const border = "#d1d5db";
const danger = "#b91c1c";

const s = StyleSheet.create({
  page: { padding: 56, fontSize: 11, fontFamily: "Times-Roman", color: charcoal, lineHeight: 1.5 },
  letterhead: { textAlign: "center", marginBottom: 18, paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: charcoal },
  companyName: { fontSize: 16, fontFamily: "Times-Bold", color: charcoal, marginBottom: 4 },
  companyMeta: { fontSize: 9.5, color: slate },
  dateLine: { marginTop: 14, marginBottom: 4 },
  certifiedLine: { fontFamily: "Times-Bold", marginBottom: 14, fontSize: 10.5 },
  addressee: { marginBottom: 16 },
  reLine: { fontFamily: "Times-Bold", marginBottom: 14 },
  para: { marginBottom: 10, textAlign: "justify" },
  signoff: { marginTop: 24 },
  sigName: { fontFamily: "Times-Bold", marginTop: 24 },
});

interface Props {
  data: DemandLetterResult;
  bodyOverride?: string;
}

export function DemandLetterPDF({ data, bodyOverride }: Props) {
  const body = (bodyOverride || data.body || "").trim();
  // Split body into paragraphs
  const paragraphs = body.split(/\n\s*\n/).map(p => p.replace(/\n/g, " ").trim()).filter(Boolean);

  const company = data.company || {};
  const recipient = data.recipient || { name: "", address: "", email: null };

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <View style={s.letterhead}>
          <Text style={s.companyName}>{company.name || ""}</Text>
          {company.address ? <Text style={s.companyMeta}>{company.address}</Text> : null}
          <Text style={s.companyMeta}>
            {company.phone ? `Tel: ${company.phone}` : ""}
            {company.phone && company.email ? "  ·  " : ""}
            {company.email || ""}
          </Text>
        </View>

        <Text style={s.dateLine}>{data.letter_date}</Text>
        <Text style={s.certifiedLine}>VIA CERTIFIED MAIL, RETURN RECEIPT REQUESTED</Text>

        <View style={s.addressee}>
          <Text style={{ fontFamily: "Times-Bold" }}>{recipient.name}</Text>
          {recipient.address?.split("\n").map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </View>

        {paragraphs.map((p, i) => {
          // Headings-ish: lines starting with "Re:" become bold
          if (/^Re:/i.test(p)) return <Text key={i} style={s.reLine}>{p}</Text>;
          // Demand sentence — keep emphasis
          if (/within ten \(10\) business days/i.test(p)) {
            return <Text key={i} style={[s.para, { fontFamily: "Times-Bold", color: danger }]}>{p}</Text>;
          }
          return <Text key={i} style={s.para}>{p}</Text>;
        })}
      </Page>
    </Document>
  );
}
