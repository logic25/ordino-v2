import { Walkthrough } from "./WalkthroughProvider";

export const WALKTHROUGHS: Walkthrough[] = [
  {
    id: "getting-started",
    name: "Getting Started with Ordino",
    startPath: "/dashboard",
    steps: [
      {
        target: '[data-tour="sidebar"]',
        title: "Navigation Sidebar",
        content: "This is your main navigation. Access all modules — Projects, Proposals, Billing, Time, and more — from here.",
        placement: "right",
      },
      {
        target: '[data-tour="dashboard"]',
        title: "Your Dashboard",
        content: "The dashboard shows role-specific views. PMs see their daily tasks, Admins see company-wide KPIs, and Accounting sees billing summaries.",
        placement: "bottom",
      },
      {
        target: '[data-tour="topbar-search"]',
        title: "Quick Search",
        content: "Use the search bar to find projects, clients, properties, or invoices instantly.",
        placement: "bottom",
      },
      {
        target: '[data-tour="topbar-notifications"]',
        title: "Notifications",
        content: "Stay up to date with billing submissions, project updates, and proposal activity. Configure notification preferences in Settings.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "projects-workflow",
    name: "Managing Projects",
    startPath: "/projects",
    steps: [
      {
        target: '[data-tour="projects-header"]',
        title: "Projects Page",
        content: "Here you can see all your projects. Filter by status, PM, or client.",
        placement: "bottom",
      },
      {
        target: '[data-tour="projects-stats"]',
        title: "Project Stats",
        content: "At a glance, see how many projects are open, on hold, completed, and the total value across your portfolio.",
        placement: "bottom",
      },
      {
        target: '[data-tour="nav-proposals"]',
        title: "Proposals",
        content: "Create and send proposals from here. Once accepted, proposals convert into projects automatically.",
        placement: "right",
      },
      {
        target: '[data-tour="nav-invoices"]',
        title: "Billing & Invoices",
        content: "Track invoices, collections, payment promises, and retainers. PMs submit billing requests that appear here for accounting.",
        placement: "right",
      },
    ],
  },
  {
    id: "proposals-workflow",
    name: "Proposals & Leads",
    startPath: "/proposals",
    steps: [
      {
        target: '[data-tour="proposals-header"]',
        title: "Proposals Page",
        content: "Create, send, and track proposals for new work. Proposals can be signed digitally and convert into projects.",
        placement: "bottom",
      },
      {
        target: '[data-tour="proposals-stats"]',
        title: "Pipeline Overview",
        content: "Track your conversion rate, revenue won, and proposals awaiting client approval — all updated in real time.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "billing-workflow",
    name: "Billing & Collections",
    startPath: "/invoices",
    steps: [
      {
        target: '[data-tour="billing-header"]',
        title: "Billing Page",
        content: "Create, send, and track invoices. View outstanding balances and payment history.",
        placement: "bottom",
      },
      {
        target: '[data-tour="billing-page"]',
        title: "Invoice Management",
        content: "Filter invoices by status — outstanding, overdue, collections, retainers, and payment promises. Click any invoice to view details.",
        placement: "top",
      },
      {
        target: '[data-tour="nav-time"]',
        title: "Time Tracking",
        content: "Log billable and non-billable time. Clock in/out for attendance. Time entries feed into invoice creation.",
        placement: "right",
      },
      {
        target: '[data-tour="nav-clients"]',
        title: "Client Management",
        content: "Manage contacts, billing rules, and payment analytics per client. Set up special portal requirements and vendor IDs.",
        placement: "right",
      },
    ],
  },
  {
    id: "email-calendar",
    name: "Email & Calendar",
    startPath: "/emails",
    steps: [
      {
        target: '[data-tour="email-header"]',
        title: "Email Page",
        content: "Connect your Gmail to sync emails. Tag and link emails to projects or clients.",
        placement: "bottom",
      },
      {
        target: '[data-tour="email-search"]',
        title: "Search & Filter Emails",
        content: "Search your synced inbox or search all of Gmail directly. Filter by inbox, sent, scheduled, drafts, and tagged emails.",
        placement: "bottom",
      },
      {
        target: '[data-tour="nav-calendar"]',
        title: "Calendar",
        content: "View and manage appointments, inspections, and deadlines. Syncs with Google Calendar.",
        placement: "right",
      },
    ],
  },
  {
    id: "settings-overview",
    name: "Configuring Settings",
    startPath: "/settings",
    steps: [
      {
        target: '[data-tour="settings-header"]',
        title: "Settings Hub",
        content: "Configure your profile, company info, team members, service catalog, notification preferences, and automation rules.",
        placement: "bottom",
      },
      {
        target: '[data-tour="settings-sections"]',
        title: "Settings Sections",
        content: "Click any section to configure it — Profile, Company, Team, Service Catalog, Invoicing, Automation Rules, and more.",
        placement: "bottom",
      },
      {
        target: '[data-tour="nav-reports"]',
        title: "Reports & Analytics",
        content: "View billing reports, project status, proposal metrics, time tracking summaries, and referral analytics.",
        placement: "right",
      },
    ],
  },
  {
    id: "change-orders-workflow",
    name: "Change Orders",
    startPath: "/projects",
    steps: [
      {
        target: '[data-tour="projects-header"]',
        title: "Starting with a Project",
        content: "Change orders live inside a project. Open any project and go to the COs tab to manage scope changes.",
        placement: "bottom",
      },
      {
        target: '[data-tour="sidebar"]',
        title: "Create a Change Order",
        content: "Inside a project, click 'Create Change Order' on the COs tab. Give it a title, set the amount, and choose a status. CO numbers are assigned automatically — CO#1, CO#2, etc.",
        placement: "right",
      },
      {
        target: '[data-tour="sidebar"]',
        title: "Internal Signature",
        content: "Once created, open the CO detail and click 'Sign Internally'. Use the signature pad or your saved signature. This moves the CO to Pending Client status.",
        placement: "right",
      },
      {
        target: '[data-tour="sidebar"]',
        title: "Client Signature & Approval",
        content: "After internal sign-off, click 'Send to Client'. When the client signs or you receive verbal approval, mark the CO as Approved. Approved COs add to the project's adjusted contract total.",
        placement: "right",
      },
      {
        target: '[data-tour="sidebar"]',
        title: "Negative COs (Dropped Services)",
        content: "When a PM drops a service from the Services tab, a negative change order is automatically created and voided — keeping your financial history clean and auditable.",
        placement: "right",
      },
    ],
  },
  {
    id: "ai-stress-test",
    name: "AI Roadmap Stress Test",
    startPath: "/help",
    steps: [
      {
        target: '[data-tour="sidebar"]',
        title: "Navigate to Help Center",
        content: "The AI Roadmap tools live in the Help Center under the Product Roadmap tab, which is only visible to admins.",
        placement: "right",
      },
      {
        target: '[data-tour="sidebar"]',
        title: "Product Roadmap Tab",
        content: "The roadmap tracks known gaps, planned features, and work in progress. You can view it as a Kanban board or a sortable table.",
        placement: "right",
      },
      {
        target: '[data-tour="sidebar"]',
        title: "AI Intake Button",
        content: "Click 'AI Intake' to open the AI analysis tool. It has two modes: Analyze Behavior (scans 30 days of usage patterns) and Stress-Test an Idea (evaluate a specific feature idea).",
        placement: "right",
      },
      {
        target: '[data-tour="sidebar"]',
        title: "Stress-Test Existing Items",
        content: "Click any Kanban card to open it, then click 'Run AI Stress Test' at the bottom of the edit dialog. The AI evaluates the item's priority, surfaces implementation risks, and saves the result directly to the card.",
        placement: "right",
      },
      {
        target: '[data-tour="sidebar"]',
        title: "Reading the AI Badge",
        content: "Cards that have been stress-tested show a purple '⚡ AI tested' badge. Click the card to see the full analysis — evidence, duplicate warnings, and implementation challenges.",
        placement: "right",
      },
    ],
  },
  {
    id: "ai-collections",
    name: "AI Collections & Payment Risk",
    startPath: "/invoices",
    steps: [
      {
        target: '[data-tour="billing-header"]',
        title: "Collections & Payment Risk",
        content: "The AI analyzes each client's payment history to score their payment risk. High-risk clients are flagged automatically so you can prioritize follow-ups.",
        placement: "bottom",
      },
      {
        target: '[data-tour="billing-page"]',
        title: "Collections Tab",
        content: "Switch to the Collections tab on the invoices page. Each overdue invoice shows an AI-recommended action and a draft collection message tailored to that client's behavior.",
        placement: "top",
      },
      {
        target: '[data-tour="billing-page"]',
        title: "AI Collection Messages",
        content: "Click 'Generate Message' on any collection task. The AI drafts a personalized message based on the client's history — tone, contact preference, and prior responses. You review and send, never automated.",
        placement: "top",
      },
      {
        target: '[data-tour="billing-page"]',
        title: "Payment Promises",
        content: "When a client commits to a payment date, log it as a Promise. AI monitors whether promises are kept and updates the client's reliability score over time.",
        placement: "top",
      },
      {
        target: '[data-tour="nav-clients"]',
        title: "Client Payment Analytics",
        content: "Open any client and go to the Billing Analytics tab. You'll see their avg days to pay, on-time rate, and AI-generated risk score built from their full invoice history.",
        placement: "right",
      },
    ],
  },
  {
    id: "ai-plan-analysis",
    name: "AI Plan & Proposal Analysis",
    startPath: "/proposals",
    steps: [
      {
        target: '[data-tour="proposals-header"]',
        title: "AI-Powered Proposals",
        content: "When creating a proposal, you can upload architectural plans. The AI reads the plans and auto-suggests services, scope items, and estimated hours.",
        placement: "bottom",
      },
      {
        target: '[data-tour="proposals-stats"]',
        title: "Upload Plans",
        content: "In the proposal form, go to the 'Plans' section and upload PDF drawings. The AI extracts scope from the plans and pre-fills the services section.",
        placement: "bottom",
      },
      {
        target: '[data-tour="nav-rfps"]',
        title: "RFP Discovery",
        content: "The RFP module uses AI to discover and score government RFPs relevant to your company. It monitors new postings daily and ranks them by fit.",
        placement: "right",
      },
      {
        target: '[data-tour="nav-rfps"]',
        title: "RFP Builder",
        content: "Use the AI-assisted RFP Builder to generate proposals for discovered RFPs. It pulls from your company profile, staff bios, and past notable projects automatically.",
        placement: "right",
      },
    ],
  },
] satisfies Walkthrough[];
