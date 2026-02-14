import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { referral_id } = await req.json();
    if (!referral_id) throw new Error("Missing referral_id");

    // Fetch referral
    const { data: referral, error: refErr } = await supabase
      .from("claimflow_referrals")
      .select("*")
      .eq("id", referral_id)
      .single();
    if (refErr || !referral) throw new Error("Referral not found");

    // Verify user belongs to same company
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, display_name")
      .eq("user_id", user.id)
      .single();
    if (!profile || profile.company_id !== referral.company_id) {
      throw new Error("Unauthorized - company mismatch");
    }

    // Fetch all related data in parallel
    const [invoiceRes, clientRes, followUpsRes, activityRes, companyRes, promisesRes, proposalRes] =
      await Promise.all([
        supabase
          .from("invoices")
          .select("*, projects(id, name, project_number), billed_to_contact:client_contacts(*)")
          .eq("id", referral.invoice_id)
          .single(),
        referral.client_id
          ? supabase
              .from("clients")
              .select("*, client_contacts(*)")
              .eq("id", referral.client_id)
              .single()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("invoice_follow_ups")
          .select("*")
          .eq("invoice_id", referral.invoice_id)
          .order("follow_up_date", { ascending: false }),
        supabase
          .from("invoice_activity_log")
          .select("*")
          .eq("invoice_id", referral.invoice_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("companies")
          .select("name, address, phone, email")
          .eq("id", referral.company_id)
          .single(),
        supabase
          .from("payment_promises")
          .select("*")
          .eq("invoice_id", referral.invoice_id)
          .order("created_at", { ascending: false }),
        // Try to find a proposal linked to the project
        supabase
          .from("proposals")
          .select("*, proposal_contacts(*)")
          .eq("company_id", referral.company_id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    const invoice = invoiceRes.data;
    const client = clientRes.data;
    const followUps = followUpsRes.data || [];
    const activity = activityRes.data || [];
    const company = companyRes.data;
    const promises = promisesRes.data || [];
    const proposals = proposalRes.data || [];
    if (!invoice) throw new Error("Invoice not found");

    // Generate PDF
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;
    let y = 50;

    const addPage = () => {
      doc.addPage();
      y = 50;
    };

    const checkPageBreak = (needed: number) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 60) {
        addPage();
      }
    };

    const drawLine = () => {
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
    };

    // Header
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("CLAIMFLOW LEGAL PACKAGE", pageWidth / 2, y, { align: "center" });
    y += 18;
    doc.setFontSize(16);
    doc.setTextColor(30);
    doc.text(company?.name || "Company", pageWidth / 2, y, { align: "center" });
    y += 14;
    if (company?.address) {
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(company.address, pageWidth / 2, y, { align: "center" });
      y += 12;
    }
    if (company?.phone || company?.email) {
      doc.setFontSize(9);
      doc.text(
        [company?.phone, company?.email].filter(Boolean).join(" | "),
        pageWidth / 2,
        y,
        { align: "center" }
      );
      y += 12;
    }
    y += 5;
    drawLine();
    y += 5;

    // Generated timestamp
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Generated: ${new Date().toLocaleString("en-US")}`, margin, y);
    doc.text(`Ref: ${referral.id.substring(0, 8)}`, pageWidth - margin, y, { align: "right" });
    y += 20;

    // Section 1: Case Summary
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text("1. CASE SUMMARY", margin, y);
    y += 18;

    const daysOverdue = invoice.due_date
      ? Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000))
      : 0;

    const summaryFields = [
      ["Client", client?.name || "Unknown"],
      ["Invoice Number", invoice.invoice_number],
      ["Amount Owed", `$${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}`],
      ["Original Due Date", invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-US") : "N/A"],
      ["Days Overdue", String(daysOverdue)],
      ["Project", invoice.projects ? `${invoice.projects.project_number} — ${invoice.projects.name}` : "N/A"],
      ["Payment Terms", invoice.payment_terms || "Net 30"],
    ];

    doc.setFontSize(10);
    for (const [label, value] of summaryFields) {
      checkPageBreak(16);
      doc.setTextColor(100);
      doc.text(`${label}:`, margin + 10, y);
      doc.setTextColor(30);
      doc.text(value, margin + 140, y);
      y += 16;
    }
    y += 10;

    // Section 2: Line Items
    checkPageBreak(40);
    drawLine();
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text("2. INVOICE LINE ITEMS", margin, y);
    y += 18;

    const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];
    if (lineItems.length > 0) {
      // Table header
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text("Description", margin + 10, y);
      doc.text("Qty", margin + 300, y, { align: "right" });
      doc.text("Rate", margin + 370, y, { align: "right" });
      doc.text("Amount", contentWidth + margin, y, { align: "right" });
      y += 5;
      doc.setDrawColor(220);
      doc.line(margin + 10, y, pageWidth - margin, y);
      y += 12;

      doc.setTextColor(30);
      for (const item of lineItems as any[]) {
        checkPageBreak(16);
        const desc = String(item.description || "Service");
        doc.text(desc.substring(0, 45), margin + 10, y);
        doc.text(String(item.quantity || 1), margin + 300, y, { align: "right" });
        doc.text(`$${Number(item.rate || 0).toLocaleString()}`, margin + 370, y, { align: "right" });
        doc.text(`$${Number(item.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, contentWidth + margin, y, { align: "right" });
        y += 16;
      }

      y += 5;
      doc.setDrawColor(220);
      doc.line(margin + 250, y, pageWidth - margin, y);
      y += 14;
      doc.setFontSize(10);
      doc.text("Total Due:", margin + 300, y);
      doc.text(
        `$${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        contentWidth + margin,
        y,
        { align: "right" }
      );
      y += 20;
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("No line items recorded.", margin + 10, y);
      y += 20;
    }

    // Section 3: Client Contact Information
    checkPageBreak(60);
    drawLine();
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text("3. CLIENT CONTACT INFORMATION", margin, y);
    y += 18;

    if (client) {
      const contactFields = [
        ["Company Name", client.name],
        ["Email", client.email || "—"],
        ["Phone", client.phone || "—"],
        ["Address", client.address || "—"],
      ];
      doc.setFontSize(10);
      for (const [label, value] of contactFields) {
        checkPageBreak(16);
        doc.setTextColor(100);
        doc.text(`${label}:`, margin + 10, y);
        doc.setTextColor(30);
        doc.text(String(value), margin + 140, y);
        y += 16;
      }

      // Billing contact
      const billingContact = invoice.billed_to_contact;
      if (billingContact) {
        y += 5;
        doc.setTextColor(100);
        doc.setFontSize(9);
        doc.text("BILLING CONTACT", margin + 10, y);
        y += 14;
        doc.setFontSize(10);
        const bcFields = [
          ["Name", billingContact.name],
          ["Title", billingContact.title || "—"],
          ["Email", billingContact.email || "—"],
          ["Phone", billingContact.phone || billingContact.mobile || "—"],
        ];
        for (const [label, value] of bcFields) {
          checkPageBreak(16);
          doc.setTextColor(100);
          doc.text(`${label}:`, margin + 20, y);
          doc.setTextColor(30);
          doc.text(String(value), margin + 140, y);
          y += 16;
        }
      }
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("No client information on file.", margin + 10, y);
      y += 16;
    }
    y += 10;

    // Section 4: Follow-Up History
    checkPageBreak(40);
    drawLine();
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text("4. FOLLOW-UP & COLLECTION HISTORY", margin, y);
    y += 18;

    if (followUps.length > 0) {
      doc.setFontSize(9);
      for (const fu of followUps) {
        checkPageBreak(30);
        doc.setTextColor(80);
        doc.text(
          `${new Date(fu.follow_up_date).toLocaleDateString("en-US")} — ${fu.contact_method || "note"}`,
          margin + 10,
          y
        );
        y += 12;
        if (fu.notes) {
          doc.setTextColor(50);
          const lines = doc.splitTextToSize(fu.notes, contentWidth - 30);
          doc.text(lines, margin + 20, y);
          y += lines.length * 11 + 6;
        }
      }
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("No follow-up records.", margin + 10, y);
      y += 16;
    }
    y += 10;

    // Section 5: Payment Promises
    checkPageBreak(40);
    drawLine();
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text("5. PAYMENT PROMISES", margin, y);
    y += 18;

    if (promises.length > 0) {
      doc.setFontSize(9);
      for (const p of promises) {
        checkPageBreak(20);
        const status = (p as any).status || "pending";
        const amount = Number((p as any).promised_amount || 0);
        const date = (p as any).promised_date
          ? new Date((p as any).promised_date).toLocaleDateString("en-US")
          : "N/A";
        doc.setTextColor(status === "broken" ? 180 : 80);
        doc.text(
          `${date} — $${amount.toLocaleString()} — ${status.toUpperCase()}`,
          margin + 10,
          y
        );
        y += 14;
      }
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("No payment promises recorded.", margin + 10, y);
      y += 16;
    }
    y += 10;

    // Section 6: Contract / Proposal
    checkPageBreak(40);
    drawLine();
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text("6. CONTRACT / PROPOSAL", margin, y);
    y += 18;

    // Find matching proposal (by project or client)
    const matchingProposal = proposals.find((p: any) =>
      (invoice.project_id && p.project_id === invoice.project_id) ||
      (invoice.client_id && p.client_id === invoice.client_id)
    ) || proposals[0]; // fallback to most recent

    if (matchingProposal) {
      const propFields = [
        ["Proposal #", (matchingProposal as any).proposal_number || "—"],
        ["Status", ((matchingProposal as any).status || "draft").toUpperCase()],
        ["Scope", (matchingProposal as any).scope_of_work ? String((matchingProposal as any).scope_of_work).substring(0, 120) : "—"],
        ["Total", `$${Number((matchingProposal as any).total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`],
        ["Deposit Required", `$${Number((matchingProposal as any).deposit_required || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`],
        ["Date", (matchingProposal as any).created_at ? new Date((matchingProposal as any).created_at).toLocaleDateString("en-US") : "—"],
      ];
      doc.setFontSize(10);
      for (const [label, value] of propFields) {
        checkPageBreak(16);
        doc.setTextColor(100);
        doc.text(`${label}:`, margin + 10, y);
        doc.setTextColor(30);
        const displayVal = String(value);
        doc.text(displayVal.substring(0, 70), margin + 140, y);
        y += 16;
      }

      // Terms
      if ((matchingProposal as any).terms) {
        y += 5;
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text("CONTRACT TERMS", margin + 10, y);
        y += 14;
        doc.setTextColor(50);
        const termsText = String((matchingProposal as any).terms).substring(0, 500);
        const termsLines = doc.splitTextToSize(termsText, contentWidth - 20);
        checkPageBreak(termsLines.length * 11 + 10);
        doc.text(termsLines, margin + 10, y);
        y += termsLines.length * 11 + 10;
      }
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("No signed contract or proposal on file.", margin + 10, y);
      y += 16;
    }
    y += 10;

    // Section 7: Invoice Copy (formatted reproduction)
    addPage();
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("EXHIBIT A — INVOICE COPY", pageWidth / 2, y, { align: "center" });
    y += 20;

    // Invoice header
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text("INVOICE", margin, y);
    doc.setFontSize(20);
    doc.text(invoice.invoice_number, pageWidth - margin, y, { align: "right" });
    y += 25;

    // From / To columns
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("FROM", margin, y);
    doc.text("BILL TO", margin + 260, y);
    y += 14;
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.text(company?.name || "—", margin, y);
    doc.text(client?.name || "—", margin + 260, y);
    y += 13;
    doc.setFontSize(9);
    doc.setTextColor(80);
    if (company?.address) { doc.text(company.address, margin, y); y += 12; } else { y += 12; }
    const billingContact2 = invoice.billed_to_contact;
    if (billingContact2) {
      doc.text(`Attn: ${billingContact2.name}`, margin + 260, y - 12);
    }
    if (client?.address) { doc.text(client.address, margin + 260, y); }
    y += 16;

    // Invoice details
    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
    const invDetailFields = [
      ["Invoice Date", invoice.created_at ? new Date(invoice.created_at).toLocaleDateString("en-US") : "—"],
      ["Due Date", invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-US") : "—"],
      ["Terms", invoice.payment_terms || "Net 30"],
      ["Project", invoice.projects ? `${invoice.projects.project_number} — ${invoice.projects.name}` : "—"],
    ];
    doc.setFontSize(9);
    for (const [label, value] of invDetailFields) {
      doc.setTextColor(100);
      doc.text(`${label}:`, margin, y);
      doc.setTextColor(30);
      doc.text(String(value), margin + 90, y);
      y += 14;
    }
    y += 10;

    // Line items table (invoice copy)
    doc.setDrawColor(180);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 18, "F");
    doc.line(margin, y, pageWidth - margin, y);
    y += 13;
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text("DESCRIPTION", margin + 5, y);
    doc.text("QTY", margin + 300, y, { align: "right" });
    doc.text("RATE", margin + 370, y, { align: "right" });
    doc.text("AMOUNT", contentWidth + margin - 5, y, { align: "right" });
    y += 8;
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;

    doc.setFontSize(9);
    doc.setTextColor(30);
    for (const item of lineItems as any[]) {
      checkPageBreak(16);
      doc.text(String(item.description || "Service").substring(0, 50), margin + 5, y);
      doc.text(String(item.quantity || 1), margin + 300, y, { align: "right" });
      doc.text(`$${Number(item.rate || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, margin + 370, y, { align: "right" });
      doc.text(`$${Number(item.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, contentWidth + margin - 5, y, { align: "right" });
      y += 16;
    }

    // Totals
    y += 5;
    doc.line(margin + 300, y, pageWidth - margin, y);
    y += 16;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Subtotal:", margin + 310, y);
    doc.setTextColor(30);
    doc.text(`$${Number(invoice.subtotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, contentWidth + margin - 5, y, { align: "right" });
    y += 14;
    if (Number(invoice.retainer_applied) > 0) {
      doc.setTextColor(100);
      doc.text("Retainer Applied:", margin + 310, y);
      doc.setTextColor(30);
      doc.text(`-$${Number(invoice.retainer_applied).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, contentWidth + margin - 5, y, { align: "right" });
      y += 14;
    }
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text("TOTAL DUE:", margin + 310, y);
    doc.text(`$${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, contentWidth + margin - 5, y, { align: "right" });
    y += 25;

    // Special instructions
    if (invoice.special_instructions) {
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("Special Instructions:", margin, y);
      y += 12;
      doc.setTextColor(60);
      const instrLines = doc.splitTextToSize(invoice.special_instructions, contentWidth);
      doc.text(instrLines, margin, y);
      y += instrLines.length * 10 + 10;
    }

    // Section 8: Activity Log
    addPage();
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text("7. ACTIVITY LOG", margin, y);
    y += 18;

    if (activity.length > 0) {
      doc.setFontSize(8);
      const recentActivity = activity.slice(0, 20);
      for (const a of recentActivity) {
        checkPageBreak(20);
        doc.setTextColor(100);
        doc.text(
          new Date(a.created_at).toLocaleDateString("en-US"),
          margin + 10,
          y
        );
        doc.setTextColor(50);
        const actionText = `${a.action}${a.details ? ` — ${a.details}` : ""}`;
        const lines = doc.splitTextToSize(actionText, contentWidth - 100);
        doc.text(lines, margin + 85, y);
        y += lines.length * 10 + 5;
      }
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("No activity recorded.", margin + 10, y);
      y += 16;
    }
    y += 10;

    // Section 8: Case Notes
    if (referral.case_notes) {
      checkPageBreak(50);
      drawLine();
      doc.setFontSize(12);
      doc.setTextColor(30);
      doc.text("8. CASE NOTES", margin, y);
      y += 18;
      doc.setFontSize(10);
      doc.setTextColor(50);
      const noteLines = doc.splitTextToSize(referral.case_notes, contentWidth - 20);
      doc.text(noteLines, margin + 10, y);
      y += noteLines.length * 13 + 10;
    }

    // NY Statute footer on last page
    checkPageBreak(50);
    drawLine();
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      "NY Statute of Limitations: 6 years from breach date for written contracts (CPLR § 213).",
      margin,
      y
    );
    y += 12;
    doc.text(
      "This document was auto-generated and should be reviewed by legal counsel before filing.",
      margin,
      y
    );

    // Convert to blob
    const pdfOutput = doc.output("arraybuffer");
    const pdfBytes = new Uint8Array(pdfOutput);

    // Upload to storage
    const fileName = `${referral.company_id}/${referral.id}_${invoice.invoice_number}_legal-package.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("claimflow-packages")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    // Update referral with package path
    await supabase
      .from("claimflow_referrals")
      .update({
        package_storage_path: fileName,
        package_generated_at: new Date().toISOString(),
      })
      .eq("id", referral.id);

    // Get signed URL for download
    const { data: signedUrl } = await supabase.storage
      .from("claimflow-packages")
      .createSignedUrl(fileName, 3600); // 1 hour

    return new Response(
      JSON.stringify({
        success: true,
        package_path: fileName,
        download_url: signedUrl?.signedUrl || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
