import { Walkthrough } from "./WalkthroughProvider";

export const WALKTHROUGHS: Walkthrough[] = [
  {
    id: "getting-started",
    name: "Getting Started with Ordino",
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
        placement: "top",
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
    steps: [
      {
        target: '[data-tour="nav-projects"]',
        title: "Projects Page",
        content: "Click here to see all your projects. Filter by status, PM, or client.",
        placement: "right",
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
    id: "billing-workflow",
    name: "Billing & Collections",
    steps: [
      {
        target: '[data-tour="nav-invoices"]',
        title: "Invoice Management",
        content: "Create, send, and track invoices. View outstanding balances and payment history.",
        placement: "right",
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
    steps: [
      {
        target: '[data-tour="nav-emails"]',
        title: "Email Integration",
        content: "Connect your Gmail to sync emails. Tag and link emails to projects or clients. Set reminders and schedule sends.",
        placement: "right",
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
    steps: [
      {
        target: '[data-tour="nav-settings"]',
        title: "Settings Hub",
        content: "Configure your profile, company info, team members, service catalog, notification preferences, and automation rules.",
        placement: "right",
      },
      {
        target: '[data-tour="nav-reports"]',
        title: "Reports & Analytics",
        content: "View billing reports, project status, proposal metrics, time tracking summaries, and referral analytics.",
        placement: "right",
      },
    ],
  },
];
