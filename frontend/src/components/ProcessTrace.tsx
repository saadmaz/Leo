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
  AlertCircle,
  Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
        "rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md transition-all overflow-hidden",
        isExpanded ? "shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-card/60" : "shadow-sm"
      )}>
        {/* Header Summary */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/20 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary">
                {isProcessing ? <Activity className="h-5 w-5 animate-pulse" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              </div>
              {isProcessing && (
                <div className="absolute -top-1 -right-1 h-3 w-3 border-2 border-background bg-primary rounded-full animate-ping" />
              )}
            </div>
            <div className="text-left">
              <span className="text-[14px] font-semibold tracking-tight block">
                {isProcessing 
                  ? `Collaborative research in progress...` 
                  : "Intelligence synthesis complete"}
              </span>
              {!isExpanded && (
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                        {completedCount} of {agents.length} agents finished
                    </span>
                    {activeAgents.length > 0 && (
                        <span className="text-[10px] text-primary/40 pl-2 border-l border-border/60 truncate max-w-[200px]">
                            {activeAgents[0].message ? `Currently ${activeAgents[0].message.toLowerCase()}` : `Agent ${activeAgents[0].name} active`}
                        </span>
                    )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 bg-secondary/40 px-3 py-1.5 rounded-lg group-hover:bg-secondary/60 transition-colors">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
              {isExpanded ? "Hide detail" : "View detail"}
            </span>
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </div>
        </button>

        {/* Expanded View */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="border-t border-border/40"
            >
              <div className="p-5 space-y-5 max-h-[450px] overflow-y-auto custom-scrollbar">
                {agents.map((agent) => (
                  <div key={agent.name} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          agent.status === "running" ? "bg-primary animate-pulse" : 
                          ["done", "success", "completed"].includes(agent.status) ? "bg-emerald-500" :
                          agent.status === "failed" ? "bg-rose-500" : "bg-muted-foreground/30"
                        )} />
                        <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-foreground/70">
                          {agent.name.replace("_", " ")} agent
                        </span>
                      </div>
                      <Badge variant="default" className="h-5 px-2 text-[9px] font-bold tracking-widest opacity-60">
                         {agent.status}
                      </Badge>
                    </div>

                    {agent.message && (
                      <div className="pl-5 border-l border-border/60 ml-1 py-1">
                        <motion.div 
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          className="flex items-start gap-2.5 text-[13px] text-muted-foreground leading-relaxed bg-secondary/10 p-3 rounded-xl border border-border/20"
                        >
                          <Search className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/40" />
                          <span>{agent.message}</span>
                        </motion.div>
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
