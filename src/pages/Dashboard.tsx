import { Clock, FileText, Building2, AlertCircle, TrendingUp, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";

const stats = [
  {
    title: "Hours Today",
    value: "4.5",
    change: "+2.5 from yesterday",
    icon: Clock,
    trend: "up",
  },
  {
    title: "Active Projects",
    value: "12",
    change: "3 need attention",
    icon: Building2,
    trend: "neutral",
  },
  {
    title: "Pending Proposals",
    value: "5",
    change: "$24,500 total",
    icon: FileText,
    trend: "neutral",
  },
  {
    title: "Urgent Items",
    value: "2",
    change: "Due within 3 days",
    icon: AlertCircle,
    trend: "down",
  },
];

const recentProjects = [
  {
    id: 1,
    name: "689 5th Ave - Fire Alarm",
    jobNumber: "421639356",
    status: "Permit Issued",
    statusType: "success",
    client: "Spencer Development",
    lastActivity: "2 hours ago",
  },
  {
    id: 2,
    name: "Queens Blvd - Sprinkler",
    jobNumber: "421548877",
    status: "Under Review",
    statusType: "pending",
    client: "Metro Properties",
    lastActivity: "Yesterday",
  },
  {
    id: 3,
    name: "Broadway - Elevator",
    jobNumber: "422001234",
    status: "Objection",
    statusType: "urgent",
    client: "Broadway Holdings",
    lastActivity: "3 days ago",
  },
];

const quickActions = [
  { label: "Called DOB", duration: "15m", icon: "📞" },
  { label: "Emailed Client", duration: "10m", icon: "📧" },
  { label: "Reviewed Plans", duration: "30m", icon: "📋" },
  { label: "Site Visit", duration: "60m", icon: "🏗️" },
];

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Good morning!</h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your projects today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <Card key={stat.title} className="card-hover" style={{ animationDelay: `${i * 50}ms` }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.trend === "up" && <TrendingUp className="inline h-3 w-3 text-success mr-1" />}
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Projects */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Projects</CardTitle>
              <CardDescription>Your most recently active DOB applications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{project.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          project.statusType === "success"
                            ? "status-approved"
                            : project.statusType === "pending"
                            ? "status-pending"
                            : "status-urgent"
                        }`}
                      >
                        {project.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Job #{project.jobNumber} • {project.client}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">{project.lastActivity}</div>
                </div>
              ))}
              <Button variant="outline" className="w-full">
                View All Projects
              </Button>
            </CardContent>
          </Card>

          {/* Quick Time Log */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Log</CardTitle>
              <CardDescription>Log time with a single tap</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className="quick-action w-full"
                >
                  <span className="text-xl">{action.icon}</span>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.duration}</p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
                </button>
              ))}
              <Button variant="outline" className="w-full mt-2">
                Custom Entry...
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
