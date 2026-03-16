"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { BarChart3, BrainCircuit, CircleDashed, Compass, Sparkles } from "lucide-react";
import ProcessTrace from "@/components/ProcessTrace";
import ArtifactRenderer from "@/components/ArtifactRenderer";
import FindingsDisplay from "@/components/FindingsDisplay";
import SourceTrail from "@/components/SourceTrail";
import TopHeader from "@/components/layout/top-header";
import PromptComposer from "@/components/chat/prompt-composer";
import MessageCard from "@/components/chat/message-card";
import QuickPrompts from "@/components/chat/quick-prompts";
import QueryCostIndicator from "@/components/QueryCostIndicator";
import Sidebar from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ChatMessage,
  ProductContext,
  AgentStatusInfo,
  FinalResponse,
} from "@/types";
import { sendQueryStream } from "@/lib/api";
import { STARTER_CHIPS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const workspaceHighlights = [
  {
    icon: BrainCircuit,
    title: "Strategic briefs",
    description: "Executive summary, risks, and recommended bets with clear hierarchy.",
  },
  {
    icon: BarChart3,
    title: "Inline artifacts",
    description: "Competitor scorecards, charts, pricing, and maps stay in the same conversation flow.",
  },
  {
    icon: Compass,
    title: "Focused follow-ups",
    description: "Prompt suggestions keep the analysis moving without turning the app into a dashboard.",
  },
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatusInfo[]>([]);
  const [sessionId, setSessionId] = useState(() => generateId());
  const [sessionCost, setSessionCost] = useState(0);
  const [currentQueryCost, setCurrentQueryCost] = useState(0);
  const [product, setProduct] = useState<ProductContext>({
    name: "Vector Agents",
    url: "vectoragents.ai",
  });
  const [suggestedChips, setSuggestedChips] = useState<string[]>(STARTER_CHIPS);
  const [useMock, setUseMock] = useState(false);

  const handleSelectSession = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:8000/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSessionId(id);
        setProduct({ name: data.title, url: data.url || "" });
        
        // Reconstruct messages from past_queries and last_response
        const loadedMessages: ChatMessage[] = [];
        data.past_queries.forEach((q: any) => {
          loadedMessages.push({
            id: generateId(),
            role: "user",
            content: q.question,
            timestamp: new Date(),
          });
        });
        if (data.last_response) {
          loadedMessages.push({
            id: generateId(),
            role: "assistant",
            content: data.last_response.executiveSummary,
            timestamp: new Date(),
            response: data.last_response,
          });
        }
        setMessages(loadedMessages);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const handleNewChat = () => {
    setSessionId(generateId());
    setMessages([]);
    setAgentStatuses([]);
    setProduct({ name: "Vector Agents", url: "vectoragents.ai" });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, agentStatuses, scrollToBottom]);

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isProcessing) return;

    const trimmedQuery = query.trim();
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: trimmedQuery,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);
    setAgentStatuses([]); // Reset for new run

    try {
        await sendQueryStream(
            {
              product: product.name,
              domain: product.url,
              question: trimmedQuery,
              session_id: sessionId,
            },
            (update) => {
                if (update.status === "starting") {
                    const initialAgents = update.agents.map((name: string) => ({
                        name,
                        status: "queued" as const,
                        duration: 0
                    }));
                    setAgentStatuses(initialAgents);
                } else if (update.agentId) {
                    setAgentStatuses(prev => prev.map(a => 
                        a.name === update.agentId 
                        ? { ...a, status: update.status, message: update.message } 
                        : a
                    ));
                } else if (update.status === "final") {
                    const response = update.data as FinalResponse;
                    
                    const assistantMessage: ChatMessage = {
                        id: generateId(),
                        role: "assistant",
                        content: response.executiveSummary,
                        timestamp: new Date(),
                        response,
                    };

                    setMessages((prev) => [...prev, assistantMessage]);
                    setSuggestedChips(response.followUpQuestions.slice(0, 3));
                    setIsProcessing(false);
                    
                    // Update cost
                    const costStr = response.queryCostEstimate.replace('$', '');
                    const costValue = parseFloat(costStr);
                    setCurrentQueryCost(costValue);
                    setSessionCost(prev => prev + costValue);
                }
            }
        );
    } catch (error) {
      console.error("Submission error:", error);
      setIsProcessing(false);
    }
  };

  const hasResults = messages.length > 0;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar 
        currentSessionId={sessionId} 
        onSelectSession={handleSelectSession} 
        onNewChat={handleNewChat} 
      />
      
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <TopHeader product={product} onUpdate={setProduct} isProcessing={isProcessing} useMock={useMock} compact={hasResults} />
      <main
        className={cn(
          "mx-auto w-full max-w-6xl px-4 pb-40 transition-all duration-300 sm:px-6 lg:px-8",
          hasResults ? "pt-4" : "pt-8"
        )}
      >
        <QueryCostIndicator queryCost={currentQueryCost} sessionCost={sessionCost} visible={messages.length > 0} />

        {!hasResults ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-in fade-in duration-1000">
            <div className="text-center space-y-4">
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
                What can I analyze for you today?
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Boardroom-quality growth intelligence in minutes. 
                Powered by multi-agent live research.
              </p>
            </div>
            
            <div className="w-full max-w-2xl">
               <QuickPrompts prompts={suggestedChips} onSelect={handleSubmit} align="center" />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8 pt-8">
            <div className="space-y-12 pb-32">
              {messages.map((message, index) => (
                <div key={message.id} className="space-y-6">
                  <MessageCard
                    message={message}
                  />

                  {message.role === "assistant" && message.response && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <FindingsDisplay
                        findings={message.response.findings}
                        facts={message.response.facts}
                        interpretations={message.response.interpretations}
                        recommendedBets={message.response.recommendedBets}
                      />
                      
                      {message.response.artifacts && message.response.artifacts.length > 0 && (
                        <ArtifactRenderer artifacts={message.response.artifacts} />
                      )}
                      
                      <SourceTrail sources={message.response.evidence} />
                      
                      {message.response.agentStatuses
                        .filter((output) => output.status === "failed")
                        .map((output) => (
                          <div
                            key={output.name}
                            className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200"
                          >
                            {output.name} failed to provide results.
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}

              <AnimatePresence>
                {isProcessing && (
                  <div className="flex justify-center py-4">
                    <ProcessTrace
                      agents={agentStatuses}
                      isProcessing={isProcessing}
                    />
                  </div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </main>

      <PromptComposer
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
        useMock={useMock}
        setUseMock={setUseMock}
        compact={hasResults}
      />
    </div>
  </div>
);
}
