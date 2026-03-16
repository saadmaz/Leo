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
      "fixed bottom-0 left-0 right-0 p-4 pb-8 transition-all duration-500 pointer-events-none",
      compact ? "md:left-64 lg:left-72" : ""
    )}>
      <div className="mx-auto max-w-3xl pointer-events-auto">
        <form 
          onSubmit={handleSubmit}
          className="relative group"
        >
          <div className={cn(
            "rounded-2xl border bg-card/80 backdrop-blur-md shadow-2xl transition-all duration-300 ring-primary/5",
            "focus-within:ring-4 focus-within:border-primary/20",
            isProcessing ? "opacity-80" : "opacity-100"
          )}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
              placeholder="Ask Leo about market trends, competitor risks, or strategic opportunities..."
              className="w-full bg-transparent p-4 pb-12 text-[16px] resize-none focus:outline-none min-h-[60px] max-h-[200px]"
              rows={input.split('\n').length || 1}
              disabled={isProcessing}
            />
            
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 rounded-lg hover:bg-secondary/50"
                  onClick={() => setUseMock(!useMock)}
                >
                  <Sparkles className={cn("h-4 w-4", useMock ? "text-primary" : "text-muted-foreground")} />
                </Button>
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-medium hidden sm:inline">
                  {useMock ? "Demo Mode" : "Real Intelligence"}
                </span>
              </div>
              
              <div className="pointer-events-auto">
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={!input.trim() || isProcessing}
                  className="h-9 px-4 rounded-xl shadow-sm transition-all active:scale-95"
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                       <div className="h-3 w-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                       Analyzing
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Send
                      <SendHorizonal className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="mt-3 text-center">
            <p className="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-[0.2em]">
              Leo is an AI analysis engine. Always verify boardroom decisions.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
