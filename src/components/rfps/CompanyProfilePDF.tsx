import {
  Document, Page, Text, View, StyleSheet, Link,
} from "@react-pdf/renderer";
import type { RfpContent } from "@/hooks/useRfpContent";

interface CompanyInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

interface ServiceItem {
  name: string;
  description?: string;
}

interface NotableProject {
  description?: string | null;
  estimated_value?: number | null;
  status?: string | null;
  approved_date?: string | null;
  properties?: { address?: string; borough?: string } | null;
}

export interface CompanyProfileData {
  company: CompanyInfo;
  aboutUs: string | null;
  services: ServiceItem[];
  staffBios: RfpContent[];
  notableProjects: NotableProject[];
  certifications: RfpContent[];
}

const amber = "#d97706";
const darkText = "#1a1a1a";
const mutedText = "#555";
const lightBg = "#faf8f5";
const borderColor = "#e5e2dc";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: darkText, backgroundColor: "#fff" },
  // Header
  headerBar: { backgroundColor: amber, height: 4, marginBottom: 20, borderRadius: 2 },
  companyName: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  tagline: { fontSize: 10, color: mutedText, marginBottom: 16 },
  contactRow: { flexDirection: "row", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  contactItem: { fontSize: 8, color: mutedText },
  // Section
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: amber, textTransform: "uppercase" as any, letterSpacing: 1, marginBottom: 6, marginTop: 16 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: borderColor, marginBottom: 8 },
  bodyText: { fontSize: 9, color: mutedText, lineHeight: 1.6, marginBottom: 8 },
  // Services grid
  servicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  serviceChip: { backgroundColor: lightBg, borderWidth: 0.5, borderColor: borderColor, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 3 },
  serviceChipText: { fontSize: 8, color: darkText },
  // Staff
  staffRow: { flexDirection: "row", marginBottom: 6, gap: 8 },
  staffName: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  staffRole: { fontSize: 8, color: mutedText },
  staffBio: { fontSize: 8, color: mutedText, lineHeight: 1.5, marginTop: 2 },
  staffCreds: { fontSize: 7, color: amber, marginTop: 1 },
  // Projects
  projectRow: { marginBottom: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: amber },
  projectAddr: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  projectDesc: { fontSize: 8, color: mutedText, lineHeight: 1.4, marginTop: 1 },
  projectValue: { fontSize: 8, color: amber, marginTop: 1 },
  // Certs
  certRow: { flexDirection: "row", marginBottom: 4, gap: 8 },
  certName: { fontSize: 9, fontFamily: "Helvetica-Bold", flex: 1 },
  certDetail: { fontSize: 8, color: mutedText },
  // Footer
  footer: { position: "absolute", bottom: 28, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: borderColor, paddingTop: 6 },
  footerText: { fontSize: 7, color: "#999", textAlign: "center" },
});

const fmt = (n: number) => `$${n.toLocaleString()}`;

export function CompanyProfilePDF({ data }: { data: CompanyProfileData }) {
  const { company, aboutUs, services, staffBios, notableProjects, certifications } = data;

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Accent bar */}
        <View style={s.headerBar} />

        {/* Company name */}
        <Text style={s.companyName}>{company.name}</Text>
        <Text style={s.tagline}>Company Profile</Text>

        {/* Contact info */}
        <View style={s.contactRow}>
          {company.address && <Text style={s.contactItem}>{company.address}</Text>}
          {company.phone && <Text style={s.contactItem}>📞 {company.phone}</Text>}
          {company.email && <Text style={s.contactItem}>✉ {company.email}</Text>}
          {company.website && (
            <Link src={company.website.startsWith("http") ? company.website : `https://${company.website}`}>
              <Text style={s.contactItem}>🌐 {company.website}</Text>
            </Link>
          )}
        </View>

        {/* About */}
        {aboutUs && (
          <>
            <Text style={s.sectionTitle}>About Our Firm</Text>
            <View style={s.divider} />
            <Text style={s.bodyText}>{aboutUs}</Text>
          </>
        )}

        {/* Services */}
        {services.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Services</Text>
            <View style={s.divider} />
            <View style={s.servicesGrid}>
              {services.map((svc, i) => (
                <View key={i} style={s.serviceChip}>
                  <Text style={s.serviceChipText}>{svc.name}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Key Staff */}
        {staffBios.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Key Team Members</Text>
            <View style={s.divider} />
            {staffBios.slice(0, 5).map((bio) => {
              const c = bio.content as Record<string, any> | null;
              const role = c?.role || c?.title || "";
              const bioText = c?.bio || "";
              const creds = c?.credentials || "";
              const yrs = c?.years_experience;
              return (
                <View key={bio.id} style={{ marginBottom: 8 }}>
                  <Text style={s.staffName}>{bio.title}</Text>
                  <Text style={s.staffRole}>
                    {role}{yrs ? ` · ${yrs} years experience` : ""}
                  </Text>
                  {bioText && <Text style={s.staffBio}>{bioText}</Text>}
                  {creds && <Text style={s.staffCreds}>{creds}</Text>}
                </View>
              );
            })}
          </>
        )}

        {/* Notable Projects */}
        {notableProjects.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Notable Projects</Text>
            <View style={s.divider} />
            {notableProjects.slice(0, 5).map((p, i) => (
              <View key={i} style={s.projectRow}>
                <Text style={s.projectAddr}>
                  {p.properties?.address || "Project"}{p.properties?.borough ? `, ${p.properties.borough}` : ""}
                </Text>
                {p.description && <Text style={s.projectDesc}>{p.description}</Text>}
                {p.estimated_value && <Text style={s.projectValue}>{fmt(p.estimated_value)}</Text>}
              </View>
            ))}
          </>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Certifications & Licenses</Text>
            <View style={s.divider} />
            {certifications.map((cert) => {
              const c = cert.content as Record<string, any> | null;
              return (
                <View key={cert.id} style={s.certRow}>
                  <Text style={s.certName}>{cert.title}</Text>
                  <Text style={s.certDetail}>
                    {c?.issuing_agency || ""}{c?.cert_number ? ` · #${c.cert_number}` : ""}
                    {c?.expiration_date ? ` · Exp: ${c.expiration_date}` : ""}
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            {company.name} · Confidential Company Profile · Generated {new Date().toLocaleDateString()}
          </Text>
        </View>
      </Page>
    </Document>
  );
}