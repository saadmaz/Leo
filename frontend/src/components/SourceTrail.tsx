"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ExternalLink, ShieldCheck } from "lucide-react";
import { Source } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  sources: Source[];
}

const confidenceColors: Record<string, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-500",
  low: "bg-red-500",
};

function getCredibilityLabel(score: number): "high" | "medium" | "low" {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

function getDomain(url: string): string {
  try {
    const domain = url.replace(/^https?:\/\//, "").split("/")[0];
    return domain || url;
  } catch {
    return url;
  }
}

export default function SourceTrail({ sources }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-0">
        <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between text-left">
          <div>
            <CardTitle>Evidence trail</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{sources.length} sources identified during signal gathering.</p>
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
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-2">
                {sources.map((s, i) => {
                  const label = getCredibilityLabel(s.credibilityScore);
                  return (
                    <div key={i} className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${confidenceColors[label]}`} />
                          <span className="font-medium text-foreground truncate">{s.title || getDomain(s.url)}</span>
                        </div>
                        <a 
                          href={s.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <span className="truncate max-w-[200px]">{getDomain(s.url)}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      {s.retrievedAt ? (
                        <span className="text-muted-foreground">
                          retrieved {new Date(s.retrievedAt).toLocaleTimeString()}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t border-border pt-4">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> high credibility</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> medium credibility</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> low credibility</span>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
