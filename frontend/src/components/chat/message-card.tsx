"use client";

import { motion } from "framer-motion";
import { Brain, Bot, Sparkles, AlertCircle } from "lucide-react";
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
        className="flex flex-col items-end mb-10 group"
      >
        <div className="flex items-center gap-3 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">You</span>
        </div>
        <div className="max-w-[85%] rounded-2xl bg-secondary/30 px-6 py-4 text-foreground/90 shadow-sm border border-border/40">
          <p className="text-[16px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </motion.div>
    );
  }

  const response = message.response;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-6 mb-16"
    >
      <div className="flex gap-5 items-start">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary shadow-sm">
          <Brain className="h-5 w-5" />
        </div>
        
        <div className="flex-1 space-y-4 min-w-0 pt-1">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-[16px] leading-8 text-foreground/90 whitespace-pre-wrap font-normal">
              {message.content}
            </p>
          </div>

          {response && (
            <div className="flex items-center gap-6 pt-4">
              <div className="flex flex-wrap gap-3">
                <Badge variant="default" className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider bg-secondary/20 border-border/40 text-muted-foreground transition-none">
                  {response.agentStatuses?.length || 0} Agents
                </Badge>
                <Badge variant="default" className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider bg-secondary/20 border-border/40 text-muted-foreground transition-none">
                  {response.evidence?.length || 0} Sources
                </Badge>
                <Badge variant="default" className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider bg-primary/5 border-primary/10 text-primary/80 transition-none">
                  {response.queryCostEstimate} Est. Cost
                </Badge>
              </div>
              
              {showContextHint && (
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-primary/40">
                  <Sparkles className="h-3 w-3" />
                  Contextual
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {response?.errors?.length ? (
        <div className="ml-14 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-700/80 dark:text-amber-200/60 flex items-start gap-2">
           <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
           <span>The following sources were unreachable: {response.errors.join(". ")}</span>
        </div>
      ) : null}
    </motion.div>
  );
}
