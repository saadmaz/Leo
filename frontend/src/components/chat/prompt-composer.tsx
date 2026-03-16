"use client";

import { Dispatch, FormEvent, SetStateAction } from "react";
import { cn } from "@/lib/utils";
import { Paperclip, SendHorizonal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface PromptComposerProps {
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  onSubmit: (value: string) => void;
  isProcessing: boolean;
  useMock: boolean;
  setUseMock: Dispatch<SetStateAction<boolean>>;
  compact?: boolean;
}

export default function PromptComposer({
  input,
  setInput,
  onSubmit,
  isProcessing,
  useMock,
  setUseMock,
  compact = false,
}: PromptComposerProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (input.trim() && !isProcessing) {
      onSubmit(input);
    }
  };

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 p-6 pb-10 transition-all duration-500 z-50 pointer-events-none",
      compact ? "md:left-64" : "flex items-center justify-center h-[200px]"
    )}>
      <div className={cn(
        "w-full max-w-2xl mx-auto pointer-events-auto transition-all duration-500",
        !compact && "translate-y-[-120px]"
      )}>
        <form 
          onSubmit={handleSubmit}
          className="relative group bg-card border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-[22px] overflow-hidden backdrop-blur-sm"
        >
          <div className="flex flex-col">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
              placeholder="How can Leo help you grow today?"
              className="w-full bg-transparent p-4 pb-14 text-[16px] leading-relaxed resize-none focus:outline-none min-h-[56px] max-h-[220px] placeholder:text-muted-foreground/40"
              rows={input.split('\n').length || 1}
              disabled={isProcessing}
            />
            
            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "h-8 px-2 rounded-lg text-[10px] uppercase font-bold tracking-widest border border-transparent transition-all",
                    useMock ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground/60 hover:text-muted-foreground"
                  )}
                  onClick={() => setUseMock(!useMock)}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  {useMock ? "Demo" : "Live"}
                </Button>
                <div className="h-8 w-px bg-border/40 mx-1" />
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground/60 hover:text-muted-foreground"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </div>
              
              <Button 
                type="submit" 
                size="sm"
                disabled={!input.trim() || isProcessing}
                className={cn(
                  "h-8 w-8 p-0 rounded-lg transition-all active:scale-95",
                  input.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {isProcessing ? (
                  <div className="h-3 w-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <SendHorizonal className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </form>
        
        <p className="mt-3 text-center text-[10px] text-muted-foreground/30 font-medium uppercase tracking-[0.2em] select-none">
          Boardroom intelligence powered by multi-agent research
        </p>
      </div>
    </div>
  );
}
