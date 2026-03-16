"use client";

import { useEffect, useState } from "react";
import { Plus, History, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Session {
  id: string;
  title: string;
  updated_at: string;
}

interface SidebarProps {
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
}

export default function Sidebar({ currentSessionId, onSelectSession, onNewChat }: SidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, [currentSessionId]);

  const fetchSessions = async () => {
    try {
      const res = await fetch("http://localhost:8000/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    }
  };

  return (
    <div
      className={cn(
        "relative h-screen bg-background border-r border-border/40 transition-all duration-300",
        isOpen ? "w-60" : "w-0 overflow-hidden"
      )}
    >
      <div className="flex flex-col h-full px-3 py-6">
        <Button
          onClick={onNewChat}
          variant="ghost"
          className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-semibold hover:bg-secondary/60 rounded-xl mb-8 group"
        >
          <span>New Chat</span>
          <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </Button>

        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
          {sessions.length > 0 && (
            <div className="px-3 mb-4">
              <h3 className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
                Recent activity
              </h3>
            </div>
          )}

          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-xl text-[13px] transition-all truncate",
                currentSessionId === session.id
                  ? "bg-secondary/80 text-foreground font-medium shadow-sm"
                  : "hover:bg-secondary/40 text-muted-foreground"
              )}
            >
              {session.title}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-50 transition-all",
          isOpen ? "left-[230px]" : "left-4"
        )}
      >
        <div className="p-1 hover:bg-secondary rounded-lg border border-border/40 bg-background/80 backdrop-blur shadow-sm">
          {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>
    </div>
  );
}
