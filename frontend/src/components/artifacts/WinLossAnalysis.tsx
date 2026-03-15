"use client";

import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface InsightItem {
  insight: string;
  frequency: number;
  sentiment: number;
  sources: string[];
}

interface Props {
  payload: {
    wins: InsightItem[];
    losses: InsightItem[];
    buyer_summary: string;
  };
}

function SentimentBar({ value }: { value: number }) {
  const width = Math.abs(value) * 100;
  const isPositive = value > 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${isPositive ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

function InsightCard({ item, type }: { item: InsightItem; type: "win" | "loss" }) {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-muted/40 p-4">
      <p className="text-sm leading-7 text-foreground">{item.insight}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Mentioned {item.frequency} times</span>
        <SentimentBar value={item.sentiment} />
      </div>
      <div className="flex flex-wrap gap-1">
        {item.sources.map((s) => (
          <span
            key={s}
            className={`text-xs px-2 py-0.5 rounded ${
              type === "win" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-rose-300"
            }`}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function WinLossAnalysis({ payload }: Props) {
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
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Win / loss analysis</CardTitle>
              <p className="text-sm text-muted-foreground">Review the strongest buying and rejection patterns from public signals.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Why deals are won</h4>
              <div className="space-y-3">
                {payload.wins.map((item, i) => (
                  <InsightCard key={i} item={item} type="win" />
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">Why deals are lost</h4>
              <div className="space-y-3">
                {payload.losses.map((item, i) => (
                  <InsightCard key={i} item={item} type="loss" />
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-[24px] border border-border bg-muted/40 p-5">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Buyer perspective summary</h4>
            <p className="text-sm leading-7 text-foreground">{payload.buyer_summary}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
