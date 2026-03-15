"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Crosshair } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Competitor {
  name: string;
  x: number;
  y: number;
  isTarget: boolean;
}

interface Props {
  payload: {
    xAxis: { label: string; labelEnd: string };
    yAxis: { label: string; labelEnd: string };
    competitors: Competitor[];
  };
}

export default function PositioningMap({ payload }: Props) {
  const [hoveredCompetitor, setHoveredCompetitor] = useState<string | null>(null);

  const width = 500;
  const height = 400;
  const padding = 60;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className=""
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-muted text-foreground">
              <Crosshair className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Positioning map</CardTitle>
              <p className="text-sm text-muted-foreground">Visualize the target against market competitors across two strategic axes.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center rounded-[24px] border border-border bg-muted/30 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-lg">
          {/* Grid */}
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#334155" strokeDasharray="4 4" />
          <line x1={width / 2} y1={padding} x2={width / 2} y2={height - padding} stroke="#334155" strokeDasharray="4 4" />

          {/* Axes */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#475569" strokeWidth={1.5} />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#475569" strokeWidth={1.5} />

          {/* Axis labels */}
          <text x={padding} y={height - padding + 30} fill="#64748b" fontSize={11} textAnchor="start">
            {payload.xAxis.label}
          </text>
          <text x={width - padding} y={height - padding + 30} fill="#64748b" fontSize={11} textAnchor="end">
            {payload.xAxis.labelEnd}
          </text>
          <text x={padding - 10} y={height - padding} fill="#64748b" fontSize={11} textAnchor="end" dominantBaseline="middle">
            {payload.yAxis.label}
          </text>
          <text x={padding - 10} y={padding} fill="#64748b" fontSize={11} textAnchor="end" dominantBaseline="middle">
            {payload.yAxis.labelEnd}
          </text>

          {/* Competitors */}
          {payload.competitors.map((c) => {
            const cx = padding + c.x * (width - 2 * padding);
            const cy = height - padding - c.y * (height - 2 * padding);
            const isHovered = hoveredCompetitor === c.name;

            return (
              <g
                key={c.name}
                onMouseEnter={() => setHoveredCompetitor(c.name)}
                onMouseLeave={() => setHoveredCompetitor(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Glow effect for target */}
                {c.isTarget && (
                  <circle cx={cx} cy={cy} r={isHovered ? 18 : 14} fill="rgba(99,102,241,0.15)" />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 8 : 6}
                  fill={c.isTarget ? "#6366f1" : "#64748b"}
                  stroke={c.isTarget ? "#818cf8" : "#94a3b8"}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                />
                <text
                  x={cx}
                  y={cy - 12}
                  fill={c.isTarget ? "#a5b4fc" : "#94a3b8"}
                  fontSize={isHovered ? 12 : 10}
                  textAnchor="middle"
                  fontWeight={c.isTarget ? 600 : 400}
                >
                  {c.name}
                </text>
              </g>
            );
          })}
        </svg>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
