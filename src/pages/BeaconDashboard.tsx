import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockAnalytics } from "@/lib/beaconMockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Brain, FileText, AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const COLORS = ["#22c55e", "#eab308", "#ef4444"];

export default function BeaconDashboard() {
  const navigate = useNavigate();
  const a = mockAnalytics;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-6 w-6 text-[#22c55e]" />
            <h1 className="text-3xl font-bold tracking-tight">Beacon Dashboard</h1>
          </div>
          <p className="text-muted-foreground">AI assistant analytics and knowledge base overview</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{a.total_questions.toLocaleString()}</div><p className="text-sm text-muted-foreground">Total Questions Asked</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{a.avg_confidence}%</div><p className="text-sm text-muted-foreground">Avg Confidence Score</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{a.kb_files}</div><p className="text-sm text-muted-foreground">Knowledge Base Files</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><div className="text-2xl font-bold text-destructive">{a.low_confidence_count}</div><AlertTriangle className="h-5 w-5 text-destructive" /></div><p className="text-sm text-muted-foreground">Low Confidence Answers</p></CardContent></Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Questions by Day */}
          <Card>
            <CardHeader><CardTitle className="text-base">Questions by Day</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={a.daily_counts.slice(-14)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Confidence Distribution */}
          <Card>
            <CardHeader><CardTitle className="text-base">Confidence Distribution</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={a.confidence_distribution} dataKey="count" nameKey="level" cx="50%" cy="50%" outerRadius={90} label={({ level, percent }) => `${level} ${(percent * 100).toFixed(0)}%`}>
                    {a.confidence_distribution.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base">Questions by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={a.category_counts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="category" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Questions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Top 10 Questions This Week</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/beacon/conversations")}>
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {a.top_questions.map((q, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground w-6">#{i + 1}</span>
                    <span className="text-sm">{q.question}</span>
                  </div>
                  <Badge variant="secondary">{q.count} asks</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Gap */}
        <Card className="border-[#22c55e]/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#22c55e]" />
              Knowledge Gap Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{a.low_confidence_count} questions received low confidence answers — these topics may need knowledge base improvement.</p>
            <div className="space-y-2">
              {["Sidewalk shed renewal process", "Temporary structure permits", "Construction trailer permits", "Facade inspection filing (FISP)", "DOB NOW system outage workarounds"].map((topic, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm">{topic}</span>
                  <Button variant="outline" size="sm" onClick={() => navigate("/beacon/content-engine")}>
                    Create Content
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
