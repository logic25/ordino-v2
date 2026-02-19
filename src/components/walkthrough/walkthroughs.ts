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
] satisfies Walkthrough[];
