"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleDollarSign, Clock3, FileSearch, Info, Radar } from "lucide-react";
import { QueryMetadata } from "@/types";
import { Badge } from "@/components/ui/badge";

interface Props {
  metadata: QueryMetadata;
}

export default function AuditTrail({ metadata }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="inline-block relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
        title="Query audit trail"
      >
        <Info className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute bottom-full right-0 z-50 mb-2 w-72 rounded-3xl border border-border bg-popover p-4 shadow-lg"
          >
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Query audit trail</h4>
            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-3 py-2">
                <span className="flex items-center gap-2 text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Timestamp</span>
                <span className="text-foreground">{metadata.timestamp.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-3 py-2">
                <span className="flex items-center gap-2 text-muted-foreground"><Radar className="h-3.5 w-3.5" /> Agents used</span>
                <span className="text-foreground">{metadata.agentsUsed.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-3 py-2">
                <span className="flex items-center gap-2 text-muted-foreground"><FileSearch className="h-3.5 w-3.5" /> Sources hit</span>
                <span className="text-foreground">{metadata.sourcesHit}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">Latency</span>
                <span className="text-foreground">{metadata.totalLatency.toFixed(1)}s</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-3 py-2">
                <span className="flex items-center gap-2 text-muted-foreground"><CircleDollarSign className="h-3.5 w-3.5" /> Est. cost</span>
                <span className="font-mono text-foreground">${metadata.estimatedCost.toFixed(2)}</span>
              </div>
              <div className="pt-2">
                <span className="text-muted-foreground">Agents</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {metadata.agentsUsed.map((a) => (
                    <Badge key={a} variant="default" className="normal-case tracking-normal">{a}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
