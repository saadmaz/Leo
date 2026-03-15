"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Lightbulb, ShieldCheck } from "lucide-react";
import { Finding } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfidenceBadge from "@/components/analysis/confidence-badge";

interface Props {
  facts: Finding[];
  interpretations: Finding[];
  recommendations: Finding[];
}

type FilterMode = "all" | "facts" | "analysis";

export default function FindingsDisplay({ facts, interpretations, recommendations }: Props) {
  const [filter, setFilter] = useState<FilterMode>("all");

  const showFacts = filter === "all" || filter === "facts";
  const showAnalysis = filter === "all" || filter === "analysis";

  const renderGroup = (items: Finding[], title: string, icon: React.ReactNode, tone: string) => (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-border bg-muted/40 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-7 text-foreground">{f.statement}</p>
              <ConfidenceBadge confidence={f.confidence} />
            </div>
            {f.rationale ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.rationale}</p> : null}
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Findings and recommendations</CardTitle>
            <p className="text-sm text-muted-foreground">Separate observed facts from strategic interpretation and action.</p>
          </div>
          <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterMode)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="facts">Facts</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showFacts && facts.length > 0
          ? renderGroup(facts, "Observed signals", <ShieldCheck className="h-5 w-5 text-sky-200" />, "bg-sky-400/10 text-sky-200")
          : null}
        {showAnalysis && interpretations.length > 0
          ? renderGroup(interpretations, "Interpretation", <BrainCircuit className="h-5 w-5 text-foreground" />, "bg-muted text-foreground")
          : null}
        {showAnalysis && recommendations.length > 0
          ? renderGroup(recommendations, "Recommended bets", <Lightbulb className="h-5 w-5 text-primary" />, "bg-primary/10 text-primary")
          : null}
      </CardContent>
    </Card>
  );
}
