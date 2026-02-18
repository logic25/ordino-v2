import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface AgingSummaryChartProps {
  aging?: { current: number; "31-60": number; "61-90": number; "90+": number };
  loading?: boolean;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(45, 90%, 50%)",
  "hsl(var(--destructive))",
];

export function AgingSummaryChart({ aging, loading }: AgingSummaryChartProps) {
  const data = aging
    ? [
        { name: "0-30 days", value: aging.current },
        { name: "31-60 days", value: aging["31-60"] },
        { name: "61-90 days", value: aging["61-90"] },
        { name: "90+ days", value: aging["90+"] },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aging Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
