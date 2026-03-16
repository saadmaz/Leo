"use client";

import { cn } from "@/lib/utils";
import { Sparkles, User, BrainCircuit, Globe, AlertCircle } from "lucide-react";
import { ChatMessage } from "@/types";

interface MessageCardProps {
  message: ChatMessage;
}

export default function MessageCard({ message }: MessageCardProps) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={cn(
      "w-full py-4 animate-in fade-in duration-500",
      isAssistant ? "assistant-message" : "user-message"
    )}>
      <div className={cn(
        "flex gap-5 max-w-3xl mx-auto px-4",
        !isAssistant && "flex-row-reverse"
      )}>
        <div className={cn(
          "flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-xl border border-border/40 text-[10px] font-bold shadow-sm",
          isAssistant ? "bg-primary/5 text-primary" : "bg-secondary text-muted-foreground"
        )}>
          {isAssistant ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <User className="h-4 w-4" />
          )}
        </div>

        <div className={cn(
          "flex flex-col gap-2 min-w-0 flex-1",
          !isAssistant && "items-end"
        )}>
          <div className={cn(
            "text-[16px] leading-relaxed tracking-normal whitespace-pre-wrap",
            isAssistant 
              ? "text-foreground font-normal" 
              : "bg-secondary/60 text-foreground px-5 py-3 rounded-2xl max-w-[85%] border border-border/20"
          )}>
            {message.content}
          </div>

          {isAssistant && message.response && (
            <div className="flex flex-wrap items-center gap-3 mt-2 opacity-60">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <BrainCircuit className="h-3 w-3" />
                {message.response.agentStatuses.length} Agents
              </div>
              <div className="h-3 w-px bg-border/40" />
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Globe className="h-3 w-3" />
                {message.response.evidence.length} Sources
              </div>
              {message.response.evidence.some(e => e.credibilityScore === 0) && (
                <>
                  <div className="h-3 w-px bg-border/40" />
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-rose-500/70">
                    <AlertCircle className="h-3 w-3" />
                    Unreachable
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
