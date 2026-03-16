"use client";

import { motion } from "framer-motion";
import { Brain, Bot } from "lucide-react";
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
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="flex justify-end mb-8"
      >
        <div className="max-w-[85%] rounded-2xl bg-secondary/40 px-5 py-3 text-foreground shadow-sm">
          <p className="text-[15px] leading-relaxed">{message.content}</p>
        </div>
      </motion.div>
    );
  }

  const response = message.response;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-6 mb-12"
    >
      {showContextHint && (
        <div className="flex items-center gap-2 pl-2 text-[11px] uppercase tracking-wider text-muted-foreground/60">
          <Brain className="h-3 w-3" />
          Building on prior context
        </div>
      )}
      
      <div className="flex gap-4 items-start">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary shadow-sm">
          <Bot className="h-4.5 w-4.5" />
        </div>
        
        <div className="flex-1 space-y-4 min-w-0">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-[15px] leading-7 text-foreground/90 whitespace-pre-wrap">
              {message.content}
            </p>
          </div>

          {response && (
            <div className="flex flex-wrap gap-4 pt-2 border-t border-border/40">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground uppercase tracking-tight">Agents</span>
                <span className="text-xs font-semibold">{response.agentStatuses?.length || 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground uppercase tracking-tight">Sources</span>
                <span className="text-xs font-semibold">{response.evidence?.length || 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground uppercase tracking-tight">Cost</span>
                <span className="text-xs font-semibold">{response.queryCostEstimate}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {response?.errors?.length ? (
        <div className="ml-12 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-700/80 dark:text-amber-200/60">
          Partial results: {response.errors.join(". ")}
        </div>
      ) : null}
    </motion.div>
  );
}
