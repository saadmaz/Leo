"use client";

import { motion } from "framer-motion";
import { ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ConfidenceBadge from "@/components/analysis/confidence-badge";

interface CompetitorPricing {
  name: string;
  model: string;
  entry_price: string;
  enterprise_price: string;
  packaging: string;
}

interface WTPSignal {
  signal: string;
  confidence: "high" | "medium" | "low";
}

interface Props {
  payload: {
    competitors: CompetitorPricing[];
    willingness_to_pay: WTPSignal[];
    gaps: string[];
  };
}

export default function PricingIntelligence({ payload }: Props) {
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
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Pricing intelligence</CardTitle>
              <p className="text-sm text-muted-foreground">Compare price architecture, willingness to pay, and packaging gaps.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto rounded-[24px] border border-border bg-muted/30">
            <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Competitor</th>
              <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Model</th>
              <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Entry Price</th>
              <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Enterprise</th>
              <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Packaging</th>
            </tr>
          </thead>
          <tbody>
            {payload.competitors.map((c, i) => (
              <tr key={c.name} className={`border-b border-border ${i % 2 === 0 ? "bg-background/40" : ""}`}>
                <td className="px-3 py-2 text-foreground font-medium">{c.name}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-xs text-primary">{c.model}</span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-foreground">{c.entry_price}</td>
                <td className="px-3 py-2 font-mono text-xs text-foreground">{c.enterprise_price}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{c.packaging}</td>
              </tr>
            ))}
          </tbody>
            </table>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Willingness-to-pay signals</h4>
              <div className="space-y-3">
                {payload.willingness_to_pay.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <span className="flex-1 text-sm leading-6 text-foreground">{s.signal}</span>
                    <ConfidenceBadge confidence={s.confidence} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pricing gaps and opportunities</h4>
              <div className="space-y-3">
                {payload.gaps.map((gap, i) => (
                  <div key={i} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-700 dark:text-emerald-300">
                    {gap}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
