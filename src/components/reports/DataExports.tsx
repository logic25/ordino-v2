import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EXPORTS = [
  {
    key: "projects",
    label: "Projects",
    description: "All projects with status, dates, and assignments",
    fetch: async () => {
      const { data } = await supabase.from("projects").select("project_number, name, status, created_at, updated_at");
      const headers = ["Project #", "Name", "Status", "Created", "Updated"];
      const rows = (data || []).map((p: any) => [p.project_number, p.name, p.status, p.created_at?.split("T")[0], p.updated_at?.split("T")[0]]);
      return { headers, rows };
    },
  },
  {
    key: "clients",
    label: "Clients",
    description: "Client directory with contact information",
    fetch: async () => {
      const { data } = await supabase.from("clients").select("name, email, phone, client_type, address, created_at");
      const headers = ["Name", "Email", "Phone", "Type", "Address", "Created"];
      const rows = (data || []).map((c: any) => [c.name, c.email, c.phone, c.client_type, c.address, c.created_at?.split("T")[0]]);
      return { headers, rows };
    },
  },
  {
    key: "invoices",
    label: "Invoices",
    description: "All invoices with amounts and payment status",
    fetch: async () => {
      const { data } = await supabase.from("invoices").select("invoice_number, status, total_due, payment_amount, due_date, paid_at, created_at");
      const headers = ["Invoice #", "Status", "Total Due", "Paid", "Due Date", "Paid At", "Created"];
      const rows = (data || []).map((i: any) => [i.invoice_number, i.status, i.total_due, i.payment_amount, i.due_date, i.paid_at?.split("T")[0], i.created_at?.split("T")[0]]);
      return { headers, rows };
    },
  },
  {
    key: "proposals",
    label: "Proposals",
    description: "Proposals with values, status, and referral info",
    fetch: async () => {
      const { data } = await supabase.from("proposals").select("proposal_number, title, status, total_amount, lead_source, referred_by, created_at");
      const headers = ["Proposal #", "Title", "Status", "Amount", "Lead Source", "Referred By", "Created"];
      const rows = (data || []).map((p: any) => [p.proposal_number, p.title, p.status, p.total_amount, p.lead_source, p.referred_by, p.created_at?.split("T")[0]]);
      return { headers, rows };
    },
  },
  {
    key: "time",
    label: "Time Entries",
    description: "Activity logs with hours and billable status",
    fetch: async () => {
      const { data } = await supabase.from("activities").select("activity_date, activity_type, duration_minutes, billable, description");
      const headers = ["Date", "Type", "Minutes", "Billable", "Description"];
      const rows = (data || []).map((a: any) => [a.activity_date, a.activity_type, a.duration_minutes, a.billable ? "Yes" : "No", a.description]);
      return { headers, rows };
    },
  },
  {
    key: "contacts",
    label: "Contacts",
    description: "All client contacts with details",
    fetch: async () => {
      const { data } = await supabase.from("client_contacts").select("name, email, phone, title, company_name, is_primary");
      const headers = ["Name", "Email", "Phone", "Title", "Company", "Primary"];
      const rows = (data || []).map((c: any) => [c.name, c.email, c.phone, c.title, c.company_name, c.is_primary ? "Yes" : "No"]);
      return { headers, rows };
    },
  },
];

export default function DataExports() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (exp: typeof EXPORTS[0]) => {
    setLoading(exp.key);
    try {
      const { headers, rows } = await exp.fetch();
      downloadCSV(`${exp.key}-export.csv`, headers, rows);
      toast.success(`${exp.label} exported (${rows.length} rows)`);
    } catch {
      toast.error("Export failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Download your data as CSV files for use in Excel, Google Sheets, or other tools.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXPORTS.map((exp) => (
          <Card key={exp.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                {exp.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{exp.description}</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleExport(exp)}
                disabled={loading === exp.key}
              >
                {loading === exp.key ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Download CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
