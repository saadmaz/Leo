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
        "relative h-screen bg-secondary/30 border-r border-border transition-all duration-300",
        isOpen ? "w-64" : "w-12"
      )}
    >
      <div className="flex flex-col h-full p-2">
        <Button
          onClick={onNewChat}
          variant="ghost"
          className={cn(
            "w-full flex items-center justify-start gap-2 mb-4 bg-background border border-border hover:bg-secondary",
            !isOpen && "justify-center p-0"
          )}
        >
          <Plus className="h-4 w-4" />
          {isOpen && <span>New Analysis</span>}
        </Button>

        <div className="flex-1 overflow-y-auto space-y-1">
          {isOpen && (
            <div className="px-2 mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <History className="h-3 w-3" />
                History
              </h3>
            </div>
          )}

          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                currentSessionId === session.id
                  ? "bg-secondary text-secondary-foreground"
                  : "hover:bg-secondary/50 text-muted-foreground",
                !isOpen && "justify-center"
              )}
            >
              <MessageSquare className="h-4 w-4 flex-shrink-0" />
              {isOpen && <span className="truncate">{session.title}</span>}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-3 top-1/2 transform -translate-y-1/2 bg-background border border-border rounded-full p-1 shadow-sm hover:bg-secondary transition-colors"
      >
        {isOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
    </div>
  );
}
