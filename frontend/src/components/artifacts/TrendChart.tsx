"use client";

import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ConfidenceBadge from "@/components/analysis/confidence-badge";

interface DataPoint {
  month: string;
  value: number;
  event: string | null;
}

interface Props {
  payload: {
    title: string;
    data: DataPoint[];
    yAxisLabel: string;
    sourceCount: number;
    confidence: string;
  };
}

export default function TrendChart({ payload }: Props) {
  const eventsData = payload.data.filter((d) => d.event);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className=""
    >
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-muted text-foreground">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{payload.title}</CardTitle>
                <p className="text-sm text-muted-foreground">Based on {payload.sourceCount} sources</p>
              </div>
            </div>
            <ConfidenceBadge confidence={payload.confidence as "high" | "medium" | "low"} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72 rounded-[24px] border border-border bg-muted/30 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={payload.data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="month"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={{ stroke: "#334155" }}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={{ stroke: "#334155" }}
              label={{ value: payload.yAxisLabel, angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#020617",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px",
                color: "#e2e8f0",
                fontSize: "12px",
              }}
              formatter={(value) => [`$${value}M`, "Market ARR"]}
              labelFormatter={(label) => {
                const point = payload.data.find((d) => d.month === label);
                return point?.event ? `${label}\n📌 ${point.event}` : label;
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: "#6366f1", r: 3 }}
              activeDot={{ r: 5, fill: "#818cf8" }}
            />
            {eventsData.map((d) => (
              <ReferenceDot
                key={d.month}
                x={d.month}
                y={d.value}
                r={6}
                fill="#f59e0b"
                stroke="#fbbf24"
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
          </div>
          {eventsData.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {eventsData.map((d) => (
                <span key={d.month} className="rounded-full border border-amber-400/15 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
                  {d.event}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
