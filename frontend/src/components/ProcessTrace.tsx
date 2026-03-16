"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Brain, 
  Globe, 
  UserSearch, 
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCall {
  tool: string;
  query: string;
  status: "running" | "completed" | "error";
}

interface AgentProcess {
  agentId: string;
  status: string;
  message?: string;
  toolCalls: ToolCall[];
}

interface ProcessTraceProps {
  agents: any[]; // AgentStatusInfo[]
  isProcessing: boolean;
}

export default function ProcessTrace({ agents, isProcessing }: ProcessTraceProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeAgents = agents.filter(a => a.status === "running");
  const completedCount = agents.filter(a => ["done", "success", "completed"].includes(a.status)).length;
  
  if (agents.length === 0) return null;

  return (
    <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className={cn(
        "rounded-2xl border border-border bg-card/50 backdrop-blur-sm transition-all overflow-hidden",
        isExpanded ? "shadow-lg" : "shadow-sm"
      )}>
        {/* Header Summary */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            </div>
            <div className="text-left">
              <span className="text-sm font-medium">
                {isProcessing 
                  ? `Intelligence gathering... (${completedCount}/${agents.length})` 
                  : "Analysis complete"}
              </span>
              {!isExpanded && activeAgents.length > 0 && (
                <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                  {activeAgents[0].message || `Agent ${activeAgents[0].name} is researching...`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isExpanded ? "Hide process" : "View process"}
            </span>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>

        {/* Expanded View */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border"
            >
              <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                {agents.map((agent) => (
                  <div key={agent.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          agent.status === "running" ? "bg-blue-500 animate-pulse" : 
                          ["done", "success", "completed"].includes(agent.status) ? "bg-emerald-500" :
                          agent.status === "failed" ? "bg-rose-500" : "bg-muted-foreground"
                        )} />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {agent.name.replace("_", " ")}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground italic font-mono">
                         {agent.status}
                      </span>
                    </div>

                    {agent.message && (
                      <div className="pl-4 border-l border-border/50 ml-1">
                        <div className="flex items-start gap-2 text-sm text-foreground/80 bg-secondary/20 p-2 rounded-lg">
                          <Globe className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                          <span>{agent.message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
