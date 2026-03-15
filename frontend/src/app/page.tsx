"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { BarChart3, BrainCircuit, CircleDashed, Compass, Sparkles } from "lucide-react";
import AgentStatusPanel from "@/components/AgentStatusPanel";
import ArtifactRenderer from "@/components/ArtifactRenderer";
import FindingsDisplay from "@/components/FindingsDisplay";
import SourceTrail from "@/components/SourceTrail";
import TopHeader from "@/components/layout/top-header";
import PromptComposer from "@/components/chat/prompt-composer";
import MessageCard from "@/components/chat/message-card";
import QuickPrompts from "@/components/chat/quick-prompts";
import QueryCostIndicator from "@/components/QueryCostIndicator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ChatMessage,
  ProductContext,
  AgentStatusInfo,
  OrchestratorResponse,
  QueryMetadata,
} from "@/types";
import { sendQuery } from "@/lib/api";
import { DEMO_AGENTS, STARTER_CHIPS, MOCK_RESPONSE } from "@/lib/mock-data";
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
  const [agentPanelCollapsed, setAgentPanelCollapsed] = useState(false);
  const [sessionId] = useState(() => generateId());
  const [sessionCost, setSessionCost] = useState(0);
  const [currentQueryCost, setCurrentQueryCost] = useState(0);
  const [product, setProduct] = useState<ProductContext>({
    name: "Vector Agents",
    url: "vectoragents.ai",
  });
  const [suggestedChips, setSuggestedChips] = useState<string[]>(STARTER_CHIPS);
  const [useMock, setUseMock] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, agentStatuses, scrollToBottom]);

  const simulateAgentExecution = useCallback((): Promise<AgentStatusInfo[]> => {
    return new Promise((resolve) => {
      const agents = DEMO_AGENTS.map((a) => ({ ...a }));
      setAgentStatuses([...agents]);
      setAgentPanelCollapsed(false);

      const schedule = [
        { time: 100, agent: 0, status: "running" as const },
        { time: 200, agent: 4, status: "running" as const },
        { time: 800, agent: 1, status: "running" as const },
        { time: 1500, agent: 4, status: "done" as const, elapsed: 1.3 },
        { time: 2000, agent: 0, status: "done" as const, elapsed: 1.9 },
        { time: 2200, agent: 3, status: "running" as const },
        { time: 2500, agent: 5, status: "running" as const },
        { time: 3000, agent: 2, status: "running" as const },
        { time: 3400, agent: 1, status: "done" as const, elapsed: 2.6 },
        { time: 4000, agent: 3, status: "done" as const, elapsed: 1.8 },
        { time: 4500, agent: 5, status: "done" as const, elapsed: 2.0 },
        { time: 5200, agent: 2, status: "done" as const, elapsed: 2.2 },
      ];

      const startTimes: Record<number, number> = {};

      schedule.forEach(({ time, agent, status, elapsed: finalElapsed }) => {
        setTimeout(() => {
          if (status === "running") {
            startTimes[agent] = Date.now();
          }
          agents[agent].status = status;
          if (finalElapsed) {
            agents[agent].elapsed = finalElapsed;
          } else if (status === "running") {
            agents[agent].elapsed = 0;
          }
          setAgentStatuses([...agents]);
        }, time);
      });

      const intervalTimer = setInterval(() => {
        let updated = false;
        agents.forEach((agent, index) => {
          if (agent.status === "running" && startTimes[index]) {
            agent.elapsed = (Date.now() - startTimes[index]) / 1000;
            updated = true;
          }
        });
        if (updated) {
          setAgentStatuses([...agents]);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(intervalTimer);
        resolve(agents);
      }, 3500);
    });
  }, []);

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

    try {
      const queryCost = 0.01 + Math.random() * 0.04;
      setCurrentQueryCost(queryCost);
      const startTime = Date.now();
      const finalAgentStatuses = await simulateAgentExecution();

      let response: OrchestratorResponse;

      if (useMock) {
        response = { ...MOCK_RESPONSE, query: trimmedQuery };
      } else {
        try {
          response = await sendQuery({
            query: trimmedQuery,
            company_name: product.name,
            product_name: product.name,
            context:
              messages.length > 0
                ? `Previous queries: ${messages
                    .filter((message) => message.role === "user")
                    .map((message) => message.content)
                    .join("; ")}`
                : undefined,
            session_id: sessionId,
          });
        } catch (error) {
          console.error("Query failed:", error);
          response = { ...MOCK_RESPONSE, query: trimmedQuery };
        }
      }

      const totalLatency = (Date.now() - startTime) / 1000;
      const totalSources = response.agent_outputs.reduce((sum, output) => sum + output.evidence.length, 0);

      const metadata: QueryMetadata = {
        timestamp: new Date(),
        agentsUsed: response.agent_outputs.map((output) => output.agent_name),
        sourcesHit: totalSources,
        totalLatency,
        estimatedCost: queryCost,
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: response.executive_summary,
        timestamp: new Date(),
        response,
        agentStatuses: finalAgentStatuses,
        metadata,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSessionCost((prev) => prev + queryCost);
      setSuggestedChips(response.follow_up_questions.slice(0, 3));
      
      setTimeout(() => setAgentPanelCollapsed(true), 1500);
    } catch (error) {
      console.error("Submission error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const allSources = messages
    .filter((message) => message.response)
    .flatMap((message) => message.response!.agent_outputs.flatMap((output) => output.evidence));
  const hasResults = messages.length > 0;

  return (
    <div className="min-h-screen bg-background">
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
                      <div className="mt-2 text-sm">{useMock ? "Demo mode" : "Live API-backed analysis"}</div>
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
                          facts={message.response.facts}
                          interpretations={message.response.interpretations}
                          recommendations={message.response.recommendations}
                        />
                        <ArtifactRenderer artifacts={message.response.artifacts} />
                        <SourceTrail sources={message.response.agent_outputs.flatMap((output) => output.evidence)} />
                        {message.response.agent_outputs
                          .filter((output) => output.status === "error" || output.status === "timeout")
                          .map((output) => (
                            <div
                              key={output.agent_name}
                              className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200"
                            >
                              {output.agent_name} returned {output.status}
                              {output.errors.length > 0 ? `: ${output.errors[0]}` : ""}
                            </div>
                          ))}
                        {index !== messages.length - 1 ? <Separator className="mt-6" /> : null}
                      </>
                    ) : null}
                  </div>
                ))}

                <AnimatePresence>
                  {isProcessing && (
                    <div className="flex justify-start">
                      <AgentStatusPanel
                        agents={agentStatuses}
                        collapsed={agentPanelCollapsed}
                        onToggle={() => setAgentPanelCollapsed(!agentPanelCollapsed)}
                        totalTime={agentStatuses.reduce((sum, agent) => sum + agent.elapsed, 0)}
                        totalSources={allSources.length}
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
  );
}
