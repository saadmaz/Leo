"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ExternalLink, ShieldCheck } from "lucide-react";
import { Evidence } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  sources: Evidence[];
}

const typeColors: Record<string, string> = {
  web_search: "text-emerald-400",
  reddit: "text-orange-400",
  hackernews: "text-amber-400",
  scraped_page: "text-blue-400",
};

const confidenceColors: Record<string, string> = {
  verified: "bg-emerald-500",
  inferred: "bg-amber-500",
  "low-signal": "bg-red-500",
};

function getSourceConfidence(source: Evidence): string {
  if (source.source_type === "web_search" && source.url) return "verified";
  if (source.source_type === "scraped_page") return "verified";
  if (source.source_type === "reddit" || source.source_type === "hackernews") return "inferred";
  return "low-signal";
}

function getSourceCategory(type: string): string {
  const map: Record<string, string> = {
    web_search: "News & Research",
    scraped_page: "Product Pages",
    reddit: "Reviews & Discussions",
    hackernews: "Reviews & Discussions",
  };
  return map[type] || "Other";
}

function getDomain(url: string): string {
  try {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  } catch {
    return url;
  }
}

export default function SourceTrail({ sources }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (sources.length === 0) return null;

  const grouped = sources.reduce<Record<string, Evidence[]>>((acc, s) => {
    const cat = getSourceCategory(s.source_type);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-0">
        <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between text-left">
          <div>
            <CardTitle>Evidence trail</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{sources.length} sources grouped by evidence quality.</p>
          </div>
          <Badge variant="default" className="gap-2 normal-case tracking-normal">
            <ShieldCheck className="h-3.5 w-3.5" />
            {expanded ? "Hide" : "Show"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Badge>
        </button>
      </CardHeader>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <CardContent className="space-y-5 pt-6">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <h5 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{category}</h5>
                  <div className="space-y-2">
                    {items.map((s, i) => {
                      const conf = getSourceConfidence(s);
                      return (
                        <div key={i} className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${confidenceColors[conf]}`} />
                              <span className={typeColors[s.source_type] || "text-muted-foreground"}>{s.title || getDomain(s.url)}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                              <span>{getDomain(s.url)}</span>
                              <ExternalLink className="h-3 w-3" />
                            </div>
                          </div>
                          {s.collected_at ? (
                            <span className="text-muted-foreground">retrieved {new Date(s.collected_at).toLocaleTimeString()}</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> verified</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> inferred</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> low-signal</span>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
