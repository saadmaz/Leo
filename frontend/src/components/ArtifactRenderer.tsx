"use client";

import { BarChart3, Compass, Crosshair, FileText, Radar, ScanSearch, Tags } from "lucide-react";
import { Artifact } from "@/types";
import CompetitiveScorecard from "./artifacts/CompetitiveScorecard";
import TrendChart from "./artifacts/TrendChart";
import PositioningMap from "./artifacts/PositioningMap";
import StrategicBrief from "./artifacts/StrategicBrief";
import WinLossAnalysis from "./artifacts/WinLossAnalysis";
import PricingIntelligence from "./artifacts/PricingIntelligence";
import AdjacentMarketRadar from "./artifacts/AdjacentMarketRadar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  artifacts: Artifact[];
}

const artifactMeta: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  competitive_scorecard: { label: "Competitor scorecard", icon: BarChart3 },
  competitor_matrix: { label: "Competitor matrix", icon: BarChart3 },
  feature_comparison: { label: "Feature comparison", icon: BarChart3 },
  trend_chart: { label: "Trend chart", icon: Compass },
  trend_timeline: { label: "Trend timeline", icon: Compass },
  signal_summary: { label: "Signal summary", icon: Compass },
  positioning_map: { label: "Positioning map", icon: Crosshair },
  positioning_summary: { label: "Positioning summary", icon: Crosshair },
  message_gap_heatmap: { label: "Message gap heatmap", icon: Crosshair },
  strategic_brief: { label: "Strategic brief", icon: FileText },
  win_loss_analysis: { label: "Win / loss analysis", icon: ScanSearch },
  objection_map: { label: "Objection map", icon: ScanSearch },
  buyer_pain_clusters: { label: "Buyer pain clusters", icon: ScanSearch },
  pricing_intelligence: { label: "Pricing intelligence", icon: Tags },
  pricing_table: { label: "Pricing table", icon: Tags },
  packaging_comparison: { label: "Packaging comparison", icon: Tags },
  adjacent_market_radar: { label: "Adjacent market radar", icon: Radar },
  threat_map: { label: "Threat map", icon: Radar },
  category_overlap: { label: "Category overlap", icon: Radar },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ArtifactRenderer({ artifacts }: Props) {
  return (
    <div className="space-y-5">
      {artifacts.map((artifact, i) => {
        const meta = artifactMeta[artifact.artifact_type];

        switch (artifact.artifact_type) {
          case "competitive_scorecard":
          case "competitor_matrix":
          case "feature_comparison":
            return <CompetitiveScorecard key={i} payload={artifact.payload as any} />;
          case "trend_chart":
          case "trend_timeline":
          case "signal_summary":
            return <TrendChart key={i} payload={artifact.payload as any} />;
          case "positioning_map":
          case "positioning_summary":
          case "message_gap_heatmap":
            return <PositioningMap key={i} payload={artifact.payload as any} />;
          case "strategic_brief":
            return <StrategicBrief key={i} payload={artifact.payload as any} />;
          case "win_loss_analysis":
          case "objection_map":
          case "buyer_pain_clusters":
            return <WinLossAnalysis key={i} payload={artifact.payload as any} />;
          case "pricing_intelligence":
          case "pricing_table":
          case "packaging_comparison":
            return <PricingIntelligence key={i} payload={artifact.payload as any} />;
          case "adjacent_market_radar":
          case "threat_map":
          case "category_overlap":
            return <AdjacentMarketRadar key={i} payload={artifact.payload as any} />;
          default:
            const Icon = meta?.icon ?? FileText;

            return (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted text-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle>{meta?.label ?? artifact.artifact_type.replace(/_/g, " ")}</CardTitle>
                      <Badge variant="default" className="mt-2 normal-case tracking-normal">Raw artifact payload</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
                    {JSON.stringify(artifact.payload, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            );
        }
      })}
    </div>
  );
}
