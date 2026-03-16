"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ProcessTrace from "@/components/ProcessTrace";
import ArtifactRenderer from "@/components/ArtifactRenderer";
import FindingsDisplay from "@/components/FindingsDisplay";
import SourceTrail from "@/components/SourceTrail";
import TopHeader from "@/components/layout/top-header";
import PromptComposer from "@/components/chat/prompt-composer";
import MessageCard from "@/components/chat/message-card";
import QuickPrompts from "@/components/chat/quick-prompts";
import Sidebar from "@/components/layout/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChatMessage,
  ProductContext,
  AgentStatusInfo,
  FinalResponse,
} from "@/types";
import { sendQueryStream } from "@/lib/api";
import { STARTER_CHIPS } from "@/lib/mock-data";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatusInfo[]>([]);
  const [sessionId, setSessionId] = useState(() => generateId());
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
    setAgentStatuses([]);

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
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/10">
      <Sidebar 
        currentSessionId={sessionId} 
        onSelectSession={handleSelectSession} 
        onNewChat={handleNewChat} 
      />
      
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <TopHeader product={product} onUpdate={setProduct} isProcessing={isProcessing} useMock={useMock} compact={hasResults} />
        
        <ScrollArea className="flex-1">
          <main className="mx-auto w-full max-w-3xl px-6 pb-48 pt-12">
            {!hasResults ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="text-center space-y-3">
                  <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground/90">
                    Growth intelligence for {product.name}
                  </h1>
                  <p className="text-[15px] text-muted-foreground/60 max-w-md mx-auto leading-relaxed">
                    Start an analysis to uncover strategic insights, competitive risks, and recommended growth bets.
                  </p>
                </div>
                
                <div className="w-full max-w-lg pt-4">
                   <QuickPrompts prompts={suggestedChips} onSelect={handleSubmit} align="center" />
                </div>
              </div>
            ) : (
              <div className="space-y-12 transition-all duration-500">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-8">
                    <MessageCard message={message} />

                    {message.role === "assistant" && message.response && (
                      <div className="ml-14 space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
                        <FindingsDisplay
                          findings={message.response.findings}
                          facts={message.response.facts}
                          interpretations={message.response.interpretations}
                          recommendedBets={message.response.recommendedBets}
                        />
                        
                        {message.response.artifacts && message.response.artifacts.length > 0 && (
                          <div className="px-2">
                             <ArtifactRenderer artifacts={message.response.artifacts} />
                          </div>
                        )}
                        
                        <div className="border-t border-border/20 pt-8 mt-12">
                          <SourceTrail sources={message.response.evidence} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isProcessing && (
                  <div className="flex justify-start ml-14 py-8 animate-in fade-in duration-500">
                    <ProcessTrace
                      agents={agentStatuses}
                      isProcessing={isProcessing}
                    />
                  </div>
                )}

                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </main>
        </ScrollArea>

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
