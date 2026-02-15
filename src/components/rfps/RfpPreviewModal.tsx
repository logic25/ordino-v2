import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import {
  Mail, Building2, Users, GitBranch, Star, FileText,
  DollarSign, Award, MapPin, Calendar, CheckCircle,
} from "lucide-react";
import type { Rfp } from "@/hooks/useRfps";

interface StaffBioContent {
  name: string;
  title: string;
  years_experience: number | null;
  bio: string;
  hourly_rate: number | null;
  include_in_org_chart?: boolean;
  reports_to?: string;
}

interface PreviewData {
  rfp: Rfp | null;
  sections: string[];
  companyInfo: any;
  staffBios: any[];
  notableProjects: any[];
  narratives: any[];
  pricing: any;
  certs: any[];
  coverLetter?: string;
}

interface RfpPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PreviewData;
}

export function RfpPreviewModal({ open, onOpenChange, data }: RfpPreviewModalProps) {
  const { rfp, sections, companyInfo, staffBios, notableProjects, narratives, pricing, certs, coverLetter } = data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden [&>button]:text-foreground [&>button]:hover:text-foreground [&>button]:top-4 [&>button]:right-4 [&>button]:z-50">
        {/* Header band */}
        <div className="bg-muted border-b px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-muted-foreground text-sm font-normal tracking-wide uppercase">
              RFP Response Preview
            </DialogTitle>
          </DialogHeader>
          <h2 className="text-xl font-bold text-foreground mt-2">{rfp?.title || "Untitled RFP"}</h2>
          <div className="flex gap-4 text-sm mt-2 flex-wrap">
            {rfp?.rfp_number && (
              <span className="bg-accent/20 text-accent px-2 py-0.5 rounded text-xs font-mono">
                RFP #{rfp.rfp_number}
              </span>
            )}
            {rfp?.agency && (
              <span className="text-muted-foreground text-xs">
                Agency: {rfp.agency}
              </span>
            )}
            {rfp?.due_date && (
              <span className="text-muted-foreground text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due: {format(new Date(rfp.due_date), "MMM d, yyyy")}
              </span>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[72vh] px-6 pb-6">
          <div className="space-y-6 mt-4">
            {sections.map((sectionId) => (
              <div key={sectionId}>
                {sectionId === "cover_letter" && coverLetter && <CoverLetterSection text={coverLetter} />}
                {sectionId === "company_info" && <CompanyInfoSection data={companyInfo} />}
                {sectionId === "staff_bios" && <StaffBiosSection data={staffBios} />}
                {sectionId === "org_chart" && <OrgChartSection data={staffBios} />}
                {sectionId === "notable_projects" && <NotableProjectsSection data={notableProjects} />}
                {sectionId === "narratives" && <NarrativesSection data={narratives} />}
                {sectionId === "pricing" && <PricingSection data={pricing} />}
                {sectionId === "certifications" && <CertsSection data={certs} />}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({ children, icon: Icon, color = "text-accent" }: { children: React.ReactNode; icon: React.ElementType; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-2 h-2 rounded-full bg-accent`} />
      <Icon className={`h-4 w-4 ${color}`} />
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>
    </div>
  );
}

function CoverLetterSection({ text }: { text: string }) {
  return (
    <div className="border-l-4 border-l-accent pl-5 py-2">
      <SectionHeading icon={Mail} color="text-accent">Cover Letter</SectionHeading>
      <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{text}</div>
      <Separator className="mt-6" />
    </div>
  );
}

function CompanyInfoSection({ data }: { data: any }) {
  const content = data?.content as Record<string, any> | undefined;
  if (!content) return <p className="text-muted-foreground text-sm italic">No company info available.</p>;

  const fields = [
    { label: "Legal Name", value: content.legal_name, color: "text-foreground font-semibold" },
    { label: "Address", value: content.address },
    { label: "Phone", value: content.phone },
    { label: "Email", value: content.email },
    { label: "Tax ID", value: content.tax_id },
    { label: "Founded", value: content.founded_year },
    { label: "Staff Count", value: content.staff_count },
    { label: "Website", value: content.website },
  ].filter((f) => f.value);

  return (
    <div>
      <SectionHeading icon={Building2} color="text-info">Company Information</SectionHeading>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.label} className="bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{f.label}</p>
            <p className={`text-sm mt-0.5 ${f.color || ""}`}>{f.value}</p>
          </div>
        ))}
      </div>
      <Separator className="mt-6" />
    </div>
  );
}

function StaffBiosSection({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-muted-foreground text-sm italic">No staff bios available.</p>;
  return (
    <div>
      <SectionHeading icon={Users} color="text-accent">Key Personnel</SectionHeading>
      <div className="space-y-3">
        {data.map((item) => {
          const c = item.content as StaffBioContent;
          const initials = c.name?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
          return (
            <div key={item.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow border-l-4 border-l-accent/50">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent ring-2 ring-accent/20 flex-shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.title}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {c.years_experience && (
                    <Badge className="text-xs bg-accent/10 text-accent border-accent/20" variant="outline">
                      {c.years_experience} yrs
                    </Badge>
                  )}
                  {c.hourly_rate && (
                    <Badge variant="outline" className="text-xs text-success border-success/30 tabular-nums">
                      ${c.hourly_rate}/hr
                    </Badge>
                  )}
                </div>
              </div>
              {c.bio && <p className="text-sm mt-2 text-muted-foreground leading-relaxed">{c.bio}</p>}
            </div>
          );
        })}
      </div>
      <Separator className="mt-6" />
    </div>
  );
}

function OrgChartSection({ data }: { data: any[] }) {
  // Include ALL staff — the org chart should show the full team
  const allStaff = data.map((i) => ({ id: i.id, content: i.content as StaffBioContent }));

  if (!allStaff.length) return <p className="text-muted-foreground text-sm italic">No org chart data.</p>;

  const byName = new Map(allStaff.map((i) => [i.content.name, i]));
  const childrenMap = new Map<string, typeof allStaff>();
  const roots: typeof allStaff = [];

  allStaff.forEach((item) => {
    const parent = item.content.reports_to;
    if (parent && byName.has(parent)) {
      const list = childrenMap.get(parent) || [];
      list.push(item);
      childrenMap.set(parent, list);
    } else {
      roots.push(item);
    }
  });

  const renderNode = (item: typeof allStaff[0], depth: number, isLast: boolean) => {
    const kids = childrenMap.get(item.content.name) || [];
    const initials = item.content.name?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

    const nodeColors = depth === 0
      ? "bg-accent text-accent-foreground shadow-md border-accent"
      : depth === 1
      ? "bg-card border-2 border-accent/30 shadow-sm"
      : "bg-card border border-border shadow-sm";

    const avatarColors = depth === 0
      ? "bg-accent-foreground/20 text-accent-foreground"
      : "bg-accent/15 text-accent";

    return (
      <div key={item.id} className="flex flex-col items-center">
        {/* Node card */}
        <div className={`rounded-xl px-4 py-3 text-center min-w-[120px] max-w-[150px] ${nodeColors}`}>
          <div className={`mx-auto mb-1.5 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${avatarColors}`}>
            {initials}
          </div>
          <p className={`font-semibold text-xs leading-tight ${depth === 0 ? "" : "text-foreground"}`}>{item.content.name}</p>
          <p className={`text-[10px] mt-0.5 ${depth === 0 ? "text-accent-foreground/70" : "text-muted-foreground"}`}>{item.content.title}</p>
        </div>

        {/* Connector line down + children */}
        {kids.length > 0 && (
          <div className="flex flex-col items-center">
            {/* Vertical line from parent */}
            <div className="w-px h-5 bg-border" />
            {/* Horizontal connector bar */}
            {kids.length > 1 && (
              <div className="relative w-full flex justify-center">
                <div className="absolute top-0 h-px bg-border" style={{
                  left: `${100 / (kids.length * 2)}%`,
                  right: `${100 / (kids.length * 2)}%`,
                }} />
              </div>
            )}
            {/* Children row */}
            <div className="flex gap-3">
              {kids.map((child, idx) => (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-px h-5 bg-border" />
                  {renderNode(child, depth + 1, idx === kids.length - 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <SectionHeading icon={GitBranch} color="text-success">Organization Chart</SectionHeading>
      <div className="flex justify-center gap-6 overflow-x-auto py-6 px-4 bg-muted/30 rounded-xl border border-border">
        {roots.map((r, i) => renderNode(r, 0, i === roots.length - 1))}
      </div>
      <Separator className="mt-6" />
    </div>
  );
}

function NotableProjectsSection({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-muted-foreground text-sm italic">No notable projects.</p>;
  return (
    <div>
      <SectionHeading icon={Star} color="text-warning">Notable Projects & References</SectionHeading>
      <div className="space-y-3">
        {data.map((proj) => {
          const props = proj.properties as any;
          return (
            <div key={proj.id} className="border rounded-xl p-4 border-l-4 border-l-warning/50 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-warning" />
                    <p className="font-semibold text-sm">{props?.address || "Unknown"}</p>
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-2 mt-1 flex-wrap">
                    {props?.borough && (
                      <span className="flex items-center gap-0.5 text-info">
                        <MapPin className="h-3 w-3" /> {props.borough}
                      </span>
                    )}
                    {proj.estimated_value && (
                      <span className="text-success font-medium tabular-nums">
                        ${proj.estimated_value.toLocaleString()}
                      </span>
                    )}
                    {proj.application_type && (
                      <Badge variant="outline" className="text-[10px] h-4 bg-info/10 text-info border-info/20">
                        {proj.application_type}
                      </Badge>
                    )}
                    {proj.description && <span>• {proj.description}</span>}
                  </div>
                </div>
              </div>
              {proj.reference_contact_name && (
                <div className="text-xs mt-2 bg-success/5 border border-success/20 rounded-lg px-3 py-2 flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-success">Reference:</span>{" "}
                    {proj.reference_contact_name}
                    {proj.reference_contact_title && `, ${proj.reference_contact_title}`}
                    {proj.reference_contact_phone && ` — ${proj.reference_contact_phone}`}
                    {proj.reference_contact_email && ` — ${proj.reference_contact_email}`}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Separator className="mt-6" />
    </div>
  );
}

function NarrativesSection({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-muted-foreground text-sm italic">No narratives available.</p>;
  return (
    <div>
      <SectionHeading icon={FileText} color="text-success">Narratives & Approach</SectionHeading>
      <div className="space-y-5">
        {data.map((item) => {
          const text = (item.content as any)?.text || "";
          return (
            <div key={item.id} className="border-l-4 border-l-success/40 pl-4">
              <p className="font-semibold text-sm mb-1">{item.title}</p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">{text}</p>
            </div>
          );
        })}
      </div>
      <Separator className="mt-6" />
    </div>
  );
}

function PricingSection({ data }: { data: any }) {
  const content = data?.content as any;
  if (!content?.labor_classifications) return <p className="text-muted-foreground text-sm italic">No pricing data.</p>;
  return (
    <div>
      <SectionHeading icon={DollarSign} color="text-accent">Pricing / Rate Schedule</SectionHeading>
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary/5">
              <th className="text-left py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Classification</th>
              <th className="text-right py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Regular</th>
              <th className="text-right py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Overtime</th>
              <th className="text-right py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Double Time</th>
            </tr>
          </thead>
          <tbody>
            {content.labor_classifications.map((lc: any, idx: number) => (
              <tr key={idx} className="border-t hover:bg-muted/30 transition-colors">
                <td className="py-2 px-3 font-medium">{lc.title}</td>
                <td className="text-right py-2 px-3 tabular-nums text-success">${lc.regular}</td>
                <td className="text-right py-2 px-3 tabular-nums text-accent">${lc.overtime}</td>
                <td className="text-right py-2 px-3 tabular-nums text-warning">${lc.doubletime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {content.annual_escalation && (
        <p className="text-xs text-muted-foreground mt-2">
          Annual escalation: <span className="text-accent font-medium">{(content.annual_escalation * 100).toFixed(0)}%</span>
        </p>
      )}
      <Separator className="mt-6" />
    </div>
  );
}

function CertsSection({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-muted-foreground text-sm italic">No certifications.</p>;
  return (
    <div>
      <SectionHeading icon={Award} color="text-info">Certifications & Licenses</SectionHeading>
      <div className="space-y-2">
        {data.map((item) => {
          const c = item.content as any;
          return (
            <div key={item.id} className="flex justify-between items-center border rounded-xl px-4 py-3 hover:shadow-md transition-shadow border-l-4 border-l-info/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-info/10 flex items-center justify-center">
                  <Award className="h-4 w-4 text-info" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.cert_type} <span className="font-mono">#{c.cert_number}</span> — {c.issuing_agency}
                  </p>
                </div>
              </div>
              {c.expiration_date && (
                <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/20">
                  Exp: {format(new Date(c.expiration_date), "MMM yyyy")}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
