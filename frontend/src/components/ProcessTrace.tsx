"use client";

import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, Loader2, CheckCircle2, AlertCircle, Search, Cpu, Globe, Database } from "lucide-react";
import { AgentStatusInfo } from "@/types";
import { cn } from "@/lib/utils";

interface ProcessTraceProps {
  agents: AgentStatusInfo[];
  isProcessing: boolean;
}

const getAgentIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("search") || n.includes("growth")) return Search;
  if (n.includes("competitive")) return Globe;
  if (n.includes("product") || n.includes("pricing")) return Database;
  return Cpu;
};

export default function ProcessTrace({ agents, isProcessing }: ProcessTraceProps) {
  const activeAgent = agents.find((a) => a.status === "running") || agents.find(a => a.status === "queued");

  return (
    <div className="w-full max-w-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex items-center gap-3">
        <div className="relative flex h-8 w-8 items-center justify-center">
            <div className="absolute inset-0 rounded-xl bg-primary/10 animate-pulse" />
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-foreground/80 tracking-tight">
            {activeAgent ? `Agent ${activeAgent.name} is working...` : "Synthesizing boardroom brief..."}
          </span>
          <span className="text-[11px] text-muted-foreground/60 font-medium">
            Analyzing live web intelligence and competitive signals
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
        {agents.map((agent) => {
          const Icon = getAgentIcon(agent.name);
          const isRunning = agent.status === "running";
          const isDone = agent.status === "success" || agent.status === "completed";
          const isFailed = agent.status === "failed";

          return (
            <div
              key={agent.name}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-all duration-300",
                isRunning 
                  ? "bg-primary/[0.03] border-primary/20 shadow-sm" 
                  : isDone 
                  ? "bg-secondary/40 border-border/40 opacity-70" 
                  : "bg-transparent border-transparent opacity-40"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-lg shrink-0",
                isRunning ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-bold tracking-tight truncate">
                  {agent.name}
                </span>
                {isRunning && agent.message && (
                  <span className="text-[10px] text-muted-foreground/80 truncate animate-pulse">
                    {agent.message}
                  </span>
                )}
              </div>

              <div className="ml-auto">
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : isFailed ? (
                  <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                ) : isRunning ? (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
