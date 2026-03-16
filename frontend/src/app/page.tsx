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
          <div className="space-y-8 py-8">
            <section className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
              <Card>
                <CardContent className="p-8 sm:p-10">
                  <Badge variant="default" className="normal-case tracking-normal">
                    Focused AI workspace
                  </Badge>
                  <h2 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                    One page for market questions, strategic answers, and evidence.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
                    Leo turns a single prompt into summaries, findings, pricing intelligence, competitor views, and follow-up opportunities inline.
                  </p>
                  <div className="mt-8">
                    <QuickPrompts prompts={suggestedChips} onSelect={handleSubmit} align="left" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="grid gap-4 p-6">
                  <div className="rounded-[24px] border border-border bg-muted/40 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Analysis target</div>
                        <div className="mt-2 text-lg font-medium">{product.name}</div>
                      </div>
                      <CircleDashed className={`h-5 w-5 ${isProcessing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">{product.url}</div>
                  </div>
                  <div className="grid gap-3">
                    <div className="rounded-[24px] border border-border bg-muted/40 p-5">
                      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Mode</div>
                      <div className="mt-2 text-sm">Live LEO multi-agent analysis</div>
                    </div>
                    <div className="rounded-[24px] border border-border bg-muted/40 p-5">
                      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Outputs</div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Executive summary, findings, charts, scorecards, pricing intelligence, risks, and follow-up prompts.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {workspaceHighlights.map((item) => (
                <Card key={item.title}>
                  <CardContent className="p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-muted text-foreground">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </section>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-[24px] border border-border bg-card p-4 transition-all duration-300">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Conversation workspace</div>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    Results render inline below each prompt with summaries, findings, artifacts, and evidence.
                  </p>
                </div>
                <QuickPrompts prompts={suggestedChips} onSelect={handleSubmit} align="left" />
              </div>
            </div>

            <ScrollArea className="h-[calc(100vh-240px)] pr-2 transition-all duration-300">
              <div className="space-y-6 pb-12">
                {messages.map((message, index) => (
                  <div key={message.id} className="space-y-5">
                    <MessageCard
                      message={message}
                      showContextHint={
                        message.role === "assistant" && messages.filter((entry) => entry.role === "user").length > 1
                      }
                    />

                    {message.role === "assistant" && message.response ? (
                      <>
                        <FindingsDisplay
                          findings={message.response.findings}
                          facts={message.response.facts}
                          interpretations={message.response.interpretations}
                          recommendedBets={message.response.recommendedBets}
                        />
                        <ArtifactRenderer artifacts={message.response.artifacts} />
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
                        {index !== messages.length - 1 ? <Separator className="mt-6" /> : null}
                      </>
                    ) : null}
                  </div>
                ))}

                <AnimatePresence>
                  {isProcessing && (
                    <div className="flex justify-center">
                      <ProcessTrace
                        agents={agentStatuses}
                        isProcessing={isProcessing}
                      />
                    </div>
                  )}
                </AnimatePresence>

                {!isProcessing && suggestedChips.length > 0 ? (
                  <Card>
                    <CardContent className="p-6">
                      <div className="mb-4 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Suggested next questions</span>
                      </div>
                      <QuickPrompts prompts={suggestedChips} onSelect={handleSubmit} align="left" />
                    </CardContent>
                  </Card>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
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
