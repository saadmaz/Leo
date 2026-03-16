"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Lightbulb, ShieldCheck } from "lucide-react";
import { Finding } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfidenceBadge from "@/components/analysis/confidence-badge";

interface Props {
  findings: Finding[];
  facts: string[];
  interpretations: string[];
  recommendedBets: string[];
}

type FilterMode = "all" | "facts" | "analysis";

export default function FindingsDisplay({ findings, facts, interpretations, recommendedBets }: Props) {
  const [filter, setFilter] = useState<FilterMode>("all");

  const showFacts = filter === "all" || filter === "facts";
  const showAnalysis = filter === "all" || filter === "analysis";

  // Map strings to Findings if possible, otherwise just display strings
  // For the LEO spec, findings carry the source and confidence
  const factualFindings = findings.filter(f => f.isFactual);
  const analysisFindings = findings.filter(f => !f.isFactual);

  const renderGroup = (title: string, icon: React.ReactNode, tone: string, content: React.ReactNode) => (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {content}
      </CardContent>
    </Card>
  );

  const renderFindings = (items: Finding[]) => items.map((f, i) => (
    <motion.div
      key={i}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="rounded-2xl border border-border bg-muted/40 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-7 text-foreground">{f.claim}</p>
        <ConfidenceBadge confidence={f.confidence} />
      </div>
    </motion.div>
  ));

  const renderStrings = (items: string[]) => items.map((s, i) => (
    <motion.div
      key={i}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="rounded-2xl border border-border bg-muted/40 p-4"
    >
      <p className="text-sm leading-7 text-foreground">{s}</p>
    </motion.div>
  ));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Findings and recommendations</CardTitle>
            <p className="text-sm text-muted-foreground">Strategic intelligence gathered by specialist agents.</p>
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
        {showFacts && factualFindings.length > 0
          ? renderGroup("Verified signals", <ShieldCheck className="h-5 w-5 text-sky-200" />, "bg-sky-400/10 text-sky-200", renderFindings(factualFindings))
          : null}
        
        {showAnalysis && analysisFindings.length > 0
          ? renderGroup("Strategic analysis", <BrainCircuit className="h-5 w-5 text-foreground" />, "bg-muted text-foreground", renderFindings(analysisFindings))
          : null}

        {showAnalysis && recommendedBets.length > 0
          ? renderGroup("Recommended bets", <Lightbulb className="h-5 w-5 text-primary" />, "bg-primary/10 text-primary", renderStrings(recommendedBets))
          : null}
      </CardContent>
    </Card>
  );
}
