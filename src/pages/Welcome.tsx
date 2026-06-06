import { AppLayout } from "@/components/layout/AppLayout";
import { GmailConnectPrompt } from "@/components/emails/GmailConnectPrompt";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, FolderKanban, Building2, Clock, FileText,
  Receipt, Mail, CalendarDays, ScrollText, BarChart3, Users,
  FileArchive, MessageSquare, HelpCircle, ArrowRight, Zap,
  Shield, Brain, Globe, Smartphone, Download,
} from "lucide-react";
import { Link } from "react-router-dom";

const FEATURE_SECTIONS = [
  {
    title: "Your Daily Command Center",
    description: "Role-based dashboards that surface exactly what you need.",
    features: [
      {
        icon: LayoutDashboard,
        name: "Smart Dashboard",
        desc: "PM, Manager, Accounting & Admin views — each tailored to your role with KPIs, action items, and quick-access widgets.",
        href: "/dashboard",
      },
      {
        icon: FolderKanban,
        name: "Project Management",
        desc: "Full project lifecycle — from proposal to close-out. Track services, checklists, DOB applications, RFIs, and change orders.",
        href: "/projects",
      },
      {
        icon: Building2,
        name: "Property Intelligence",
        desc: "NYC property lookup with BIN/BBL resolution, DOB violations, CitiSignal monitoring, and automated data enrichment from PIS & PLUTO.",
        href: "/properties",
      },
    ],
  },
  {
    title: "Revenue & Time",
    description: "From proposals to payments — every dollar and minute accounted for.",
    features: [
      {
        icon: FileText,
        name: "Proposals & E-Sign",
        desc: "Generate branded proposals, send for e-signature, and auto-convert wins into active projects with contacts and services.",
        href: "/proposals",
      },
      {
        icon: Receipt,
        name: "Billing & Collections",
        desc: "Invoice generation, aging reports, payment tracking, deposit allocation, and automated collection follow-ups.",
        href: "/invoices",
      },
      {
        icon: Clock,
        name: "Time Tracking",
        desc: "Dual-layer system — attendance auto-clock-in plus granular project activity logging. Weekly timesheets and audit trails.",
        href: "/time",
      },
    ],
  },
  {
    title: "Communication & Collaboration",
    description: "Email, calendar, chat, and documents — all connected to your projects.",
    features: [
      {
        icon: Mail,
        name: "Email Suite",
        desc: "Gmail integration with bi-directional sync. Tag, snooze, schedule sends, and link emails directly to projects.",
        href: "/emails",
      },
      {
        icon: CalendarDays,
        name: "Calendar",
        desc: "Unified view syncing Google Calendar events with project deadlines, billing milestones, and team availability.",
        href: "/calendar",
      },
      {
        icon: MessageSquare,
        name: "Team Chat",
        desc: "Google Chat spaces integration for real-time team communication linked to projects and tasks.",
        href: "/chat",
      },
      {
        icon: FileArchive,
        name: "Document Vault",
        desc: "Organized 8-folder structure per project. Upload, preview, and connect documents to Beacon AI for intelligent search.",
        href: "/documents",
      },
    ],
  },
  {
    title: "Growth & Intelligence",
    description: "Win more work with RFPs, partner networks, and AI-powered insights.",
    features: [
      {
        icon: ScrollText,
        name: "RFP Discovery",
        desc: "Discover, draft, and respond to RFPs with AI-assisted content generation and partner matching (3.5+ rating).",
        href: "/rfps",
      },
      {
        icon: Users,
        name: "CRM & Contacts",
        desc: "Company and contact management with duplicate detection, merge tools, referral tracking, and client portal access.",
        href: "/clients",
      },
      {
        icon: BarChart3,
        name: "Reports & Analytics",
        desc: "Billing, operations, time, proposal, referral, and Signal reports — exportable and filterable by date range.",
        href: "/reports",
      },
      {
        icon: Brain,
        name: "Beacon AI",
        desc: "AI assistant trained on your documents and NYC building codes. Ask questions, get instant research answers.",
        href: "/help",
      },
    ],
  },
];

const PLATFORM_HIGHLIGHTS = [
  { icon: Shield, label: "Domain-locked sign-in", detail: "@greenlightexpediting.com only" },
  { icon: Zap, label: "Role-based permissions", detail: "Admin, Manager, PM, Accounting, Production, Staff" },
  { icon: Globe, label: "NYC DOB integration", detail: "Live BIS, PIS, PLUTO data" },
  { icon: Smartphone, label: "Responsive design", detail: "Works on desktop & mobile" },
];

export default function Welcome() {
  const { profile } = useAuth();

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-10 animate-fade-in pb-12">
        {/* Hero */}
        <div className="text-center space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/30">
            <Zap className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs font-medium text-accent">Welcome to the team</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Welcome to <span className="text-accent">Ordino</span>, {profile?.first_name || "there"}!
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base">
            Ordino is Greenlight Expediting's all-in-one platform for managing projects, properties,
            proposals, billing, communications, and more — purpose-built for NYC construction expediting.
          </p>
        </div>

        {/* Connect email — first-run prompt (hidden once Gmail is connected) */}
        <GmailConnectPrompt variant="card" />

        {/* Platform highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PLATFORM_HIGHLIGHTS.map((h) => (
            <Card key={h.label} className="border-border/50">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <h.icon className="h-5 w-5 text-accent" />
                <p className="text-sm font-medium leading-tight">{h.label}</p>
                <p className="text-[11px] text-muted-foreground">{h.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Feature sections */}
        {FEATURE_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.features.map((f) => (
                <Link key={f.name} to={f.href}>
                  <Card className="h-full hover:border-accent/40 hover:shadow-md transition-all duration-200 group cursor-pointer">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                          <f.icon className="h-4.5 w-4.5 text-accent" />
                        </div>
                        <h3 className="font-semibold text-sm group-hover:text-accent transition-colors">
                          {f.name}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                      <div className="flex items-center gap-1 text-[11px] font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                        Open <ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* CTA */}
        <div className="flex flex-col items-center gap-4 pt-4">
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild>
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/help">
                <HelpCircle className="h-4 w-4 mr-2" />
                Help Desk & Guides
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="/welcome-features.pdf" target="_blank" rel="noopener">
                <Download className="h-4 w-4 mr-2" />
                Download Feature Guide
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Questions? Reach out to your manager or check the Help Desk.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
