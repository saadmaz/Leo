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
    onSubmit(input);
  };

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t border-border/70 bg-background/95 px-4 backdrop-blur transition-all duration-300 sm:px-6 lg:px-8",
        compact ? "py-3" : "py-4"
      )}
    >
      <div className="mx-auto max-w-6xl">
        <div className={cn("rounded-[28px] border border-border bg-card shadow-lg transition-all duration-300", compact ? "p-2.5" : "p-3")}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className={cn("flex items-center justify-between gap-3 px-2 transition-all duration-300", compact && "min-h-0")}>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="gap-1 normal-case tracking-normal">
                  <Sparkles className="h-3.5 w-3.5" />
                  Strategic prompt
                </Badge>
                <span className={cn("hidden text-xs text-muted-foreground sm:inline", compact && "hidden lg:inline")}>
                  Ask for competitor moves, pricing pressure, category trends, or next-best bets.
                </span>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={useMock}
                  onChange={(e) => setUseMock(e.target.checked)}
                  className="h-4 w-4 rounded border-input bg-background"
                />
                Demo mode
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="icon" className="hidden rounded-2xl sm:flex">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your market, competitors, pricing, positioning, or strategic risk..."
                disabled={isProcessing}
                className={cn("rounded-2xl text-[15px] transition-all duration-300", compact ? "h-12" : "h-14")}
              />
              <Button type="submit" size="lg" disabled={!input.trim() || isProcessing} className="min-w-[132px] rounded-2xl">
                {isProcessing ? "Analysing..." : "Send"}
                <SendHorizonal className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
