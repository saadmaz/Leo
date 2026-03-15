"use client";

import { motion } from "framer-motion";
import { Bot, User2 } from "lucide-react";
import { ChatMessage } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import AuditTrail from "@/components/AuditTrail";

interface MessageCardProps {
  message: ChatMessage;
  showContextHint?: boolean;
}

export default function MessageCard({ message, showContextHint }: MessageCardProps) {
  if (message.role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <Card className="max-w-2xl rounded-[28px] border-primary/15 bg-[linear-gradient(180deg,rgba(99,102,241,0.16),rgba(99,102,241,0.07))]">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <User2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">You asked</p>
              <p className="mt-2 text-sm leading-7 text-card-foreground">{message.content}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {showContextHint && (
        <div className="flex items-center gap-2 pl-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Building on prior conversation context
        </div>
      )}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted text-foreground">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Leo synthesis</p>
                  <Badge variant="purple" className="normal-case tracking-normal">
                    Executive summary
                  </Badge>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-card-foreground">{message.content}</p>
              </div>
            </div>
            {message.metadata && <AuditTrail metadata={message.metadata} />}
          </div>
          {message.metadata && (
            <div className="grid gap-3 px-6 py-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Agents</div>
                <div className="mt-1 text-sm font-medium text-foreground">{message.metadata.agentsUsed.length}</div>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Sources</div>
                <div className="mt-1 text-sm font-medium text-foreground">{message.metadata.sourcesHit}</div>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Latency</div>
                <div className="mt-1 text-sm font-medium text-foreground">{message.metadata.totalLatency.toFixed(1)}s</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {message.response?.errors.length ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          This response used partial data. {message.response.errors.join(". ")}
        </div>
      ) : null}
    </motion.div>
  );
}
