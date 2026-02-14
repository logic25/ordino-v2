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
}

interface RfpPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PreviewData;
}

export function RfpPreviewModal({ open, onOpenChange, data }: RfpPreviewModalProps) {
  const { rfp, sections, companyInfo, staffBios, notableProjects, narratives, pricing, certs } = data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>RFP Response Preview</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[80vh] px-6 pb-6">
          {/* Cover / Header */}
          <div className="border rounded-lg p-6 mb-6 bg-muted/30">
            <h2 className="text-xl font-bold">{rfp?.title || "Untitled RFP"}</h2>
            <div className="flex gap-4 text-sm text-muted-foreground mt-2">
              {rfp?.rfp_number && <span>RFP #{rfp.rfp_number}</span>}
              {rfp?.agency && <span>Agency: {rfp.agency}</span>}
              {rfp?.due_date && <span>Due: {format(new Date(rfp.due_date), "MMM d, yyyy")}</span>}
            </div>
          </div>

          <div className="space-y-8 prose prose-sm max-w-none dark:prose-invert">
            {sections.map((sectionId) => (
              <div key={sectionId}>
                {sectionId === "company_info" && <CompanyInfoSection data={companyInfo} />}
                {sectionId === "staff_bios" && <StaffBiosSection data={staffBios} />}
                {sectionId === "org_chart" && <OrgChartSection data={staffBios} />}
                {sectionId === "notable_projects" && <NotableProjectsSection data={notableProjects} />}
                {sectionId === "narratives" && <NarrativesSection data={narratives} />}
                {sectionId === "pricing" && <PricingSection data={pricing} />}
                {sectionId === "certifications" && <CertsSection data={certs} />}
                <Separator className="mt-6" />
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-bold border-b pb-1 mb-3">{children}</h3>;
}

function CompanyInfoSection({ data }: { data: any }) {
  const content = data?.content as Record<string, any> | undefined;
  if (!content) return <p className="text-muted-foreground text-sm italic">No company info available.</p>;
  return (
    <div>
      <SectionHeading>Company Information</SectionHeading>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {content.legal_name && <div><strong>Legal Name:</strong> {content.legal_name}</div>}
        {content.address && <div><strong>Address:</strong> {content.address}</div>}
        {content.phone && <div><strong>Phone:</strong> {content.phone}</div>}
        {content.email && <div><strong>Email:</strong> {content.email}</div>}
        {content.tax_id && <div><strong>Tax ID:</strong> {content.tax_id}</div>}
        {content.founded_year && <div><strong>Founded:</strong> {content.founded_year}</div>}
        {content.staff_count && <div><strong>Staff Count:</strong> {content.staff_count}</div>}
        {content.website && <div><strong>Website:</strong> {content.website}</div>}
      </div>
    </div>
  );
}

function StaffBiosSection({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-muted-foreground text-sm italic">No staff bios available.</p>;
  return (
    <div>
      <SectionHeading>Key Personnel</SectionHeading>
      <div className="space-y-4">
        {data.map((item) => {
          const c = item.content as StaffBioContent;
          return (
            <div key={item.id} className="border rounded-md p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.title}</p>
                </div>
                <div className="flex gap-2">
                  {c.years_experience && (
                    <Badge variant="secondary" className="text-xs">{c.years_experience} yrs</Badge>
                  )}
                  {c.hourly_rate && (
                    <Badge variant="outline" className="text-xs">${c.hourly_rate}/hr</Badge>
                  )}
                </div>
              </div>
              {c.bio && <p className="text-sm mt-2">{c.bio}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrgChartSection({ data }: { data: any[] }) {
  const eligible = data
    .map((i) => ({ id: i.id, content: i.content as StaffBioContent }))
    .filter((i) => i.content.include_in_org_chart !== false);

  if (!eligible.length) return <p className="text-muted-foreground text-sm italic">No org chart data.</p>;

  const byName = new Map(eligible.map((i) => [i.content.name, i]));
  const children = new Map<string, typeof eligible>();
  const roots: typeof eligible = [];

  eligible.forEach((item) => {
    const parent = item.content.reports_to;
    if (parent && byName.has(parent)) {
      const list = children.get(parent) || [];
      list.push(item);
      children.set(parent, list);
    } else {
      roots.push(item);
    }
  });

  const renderNode = (item: typeof eligible[0], depth: number) => {
    const kids = children.get(item.content.name) || [];
    return (
      <div key={item.id} className="flex flex-col items-center">
        <div className="border rounded-lg px-4 py-2 bg-card shadow-sm text-center min-w-[120px]">
          <p className="font-semibold text-xs">{item.content.name}</p>
          <p className="text-[10px] text-muted-foreground">{item.content.title}</p>
        </div>
        {kids.length > 0 && (
          <>
            <div className="w-px h-3 bg-border" />
            <div className="flex gap-3">
              {kids.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-px h-3 bg-border" />
                  {renderNode(child, depth + 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      <SectionHeading>Organization Chart</SectionHeading>
      <div className="flex justify-center gap-6 overflow-x-auto py-4">
        {roots.map((r) => renderNode(r, 0))}
      </div>
    </div>
  );
}

function NotableProjectsSection({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-muted-foreground text-sm italic">No notable projects.</p>;
  return (
    <div>
      <SectionHeading>Notable Projects & References</SectionHeading>
      <div className="space-y-3">
        {data.map((proj) => {
          const props = proj.properties as any;
          return (
            <div key={proj.id} className="border rounded-md p-3">
              <p className="font-semibold text-sm">{props?.address || "Unknown"}</p>
              <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                {props?.borough && <span>{props.borough}</span>}
                {proj.estimated_value && <span>• ${proj.estimated_value.toLocaleString()}</span>}
                {proj.description && <span>• {proj.description}</span>}
              </div>
              {proj.reference_contact_name && (
                <div className="text-xs mt-1.5 bg-muted/50 rounded px-2 py-1">
                  <strong>Reference:</strong> {proj.reference_contact_name}
                  {proj.reference_contact_title && `, ${proj.reference_contact_title}`}
                  {proj.reference_contact_phone && ` — ${proj.reference_contact_phone}`}
                  {proj.reference_contact_email && ` — ${proj.reference_contact_email}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NarrativesSection({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-muted-foreground text-sm italic">No narratives available.</p>;
  return (
    <div>
      <SectionHeading>Narratives & Approach</SectionHeading>
      <div className="space-y-4">
        {data.map((item) => {
          const text = (item.content as any)?.text || "";
          return (
            <div key={item.id}>
              <p className="font-semibold text-sm mb-1">{item.title}</p>
              <p className="text-sm whitespace-pre-wrap">{text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PricingSection({ data }: { data: any }) {
  const content = data?.content as any;
  if (!content?.labor_classifications) return <p className="text-muted-foreground text-sm italic">No pricing data.</p>;
  return (
    <div>
      <SectionHeading>Pricing / Rate Schedule</SectionHeading>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-1.5 font-semibold">Classification</th>
            <th className="text-right py-1.5 font-semibold">Regular</th>
            <th className="text-right py-1.5 font-semibold">Overtime</th>
            <th className="text-right py-1.5 font-semibold">Double Time</th>
          </tr>
        </thead>
        <tbody>
          {content.labor_classifications.map((lc: any, idx: number) => (
            <tr key={idx} className="border-b last:border-0">
              <td className="py-1.5">{lc.title}</td>
              <td className="text-right">${lc.regular}</td>
              <td className="text-right">${lc.overtime}</td>
              <td className="text-right">${lc.doubletime}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {content.annual_escalation && (
        <p className="text-xs text-muted-foreground mt-2">
          Annual escalation: {(content.annual_escalation * 100).toFixed(0)}%
        </p>
      )}
    </div>
  );
}

function CertsSection({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-muted-foreground text-sm italic">No certifications.</p>;
  return (
    <div>
      <SectionHeading>Certifications & Licenses</SectionHeading>
      <div className="space-y-2">
        {data.map((item) => {
          const c = item.content as any;
          return (
            <div key={item.id} className="flex justify-between items-center border rounded-md px-3 py-2">
              <div>
                <p className="font-semibold text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {c.cert_type} #{c.cert_number} — {c.issuing_agency}
                </p>
              </div>
              {c.expiration_date && (
                <Badge variant="outline" className="text-xs">
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
