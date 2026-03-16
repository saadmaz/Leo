"use client";

import { Dispatch, SetStateAction, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Paperclip, Sparkles, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isProcessing) {
        onSubmit(input);
      }
    }
  };

  return (
    <div className={cn(
      "fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40 transition-all duration-500",
      compact ? "translate-y-0 opacity-100" : "translate-y-0"
    )}>
      <div className="relative group bg-background border border-border/40 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Leo anything about your business growth..."
          rows={1}
          className="w-full resize-none bg-transparent px-5 py-4 pb-14 text-[15px] focus:outline-none placeholder:text-muted-foreground/60 custom-scrollbar leading-relaxed"
          disabled={isProcessing}
        />
        
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground/60 hover:text-primary hover:bg-secondary/40"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border/40 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUseMock(!useMock)}
              className={cn(
                "h-8 px-3 rounded-lg text-[11px] font-bold tracking-tight transition-all",
                useMock 
                  ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" 
                  : "text-muted-foreground/40 hover:text-primary hover:bg-secondary/40"
              )}
            >
              <Sparkles className={cn("mr-1.5 h-3.5 w-3.5", useMock && "animate-pulse")} />
              DEMO
            </Button>
          </div>

          <Button
            onClick={() => onSubmit(input)}
            disabled={!input.trim() || isProcessing}
            size="icon"
            className={cn(
              "h-8 w-8 rounded-lg transition-all duration-300",
              input.trim() 
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                : "bg-secondary text-muted-foreground/30"
            )}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      
      <p className="mt-3 text-center text-[11px] text-muted-foreground/40 font-medium">
        Leo can make mistakes. Verify important information.
      </p>
    </div>
  );
}
