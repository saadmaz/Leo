"use client";

import { cn } from "@/lib/utils";
import { Activity, Sparkles } from "lucide-react";
import { ProductContext } from "@/types";
import ProductContextBar from "@/components/ProductContextBar";
import ThemeToggle from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";

interface TopHeaderProps {
  product: ProductContext;
  onUpdate: (product: ProductContext) => void;
  isProcessing: boolean;
  useMock: boolean;
  compact?: boolean;
}

export default function TopHeader({ product, onUpdate, isProcessing, useMock, compact = false }: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-col px-4 transition-all duration-300 sm:px-6 lg:px-8",
          compact ? "gap-3 py-3" : "gap-4 py-4"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="purple" className="normal-case tracking-normal">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Leo Intelligence
              </Badge>
              <Badge variant={useMock ? "warning" : "default"} className="normal-case tracking-normal">
                {useMock ? "Demo mode" : "Live mode"}
              </Badge>
            </div>
            <h1
              className={cn(
                "font-semibold tracking-tight transition-all duration-300",
                compact ? "mt-2 text-lg sm:text-xl" : "mt-3 text-2xl sm:text-3xl"
              )}
            >
              Conversational growth intelligence
            </h1>
            <p
              className={cn(
                "max-w-3xl text-muted-foreground transition-all duration-300",
                compact ? "mt-0.5 text-xs sm:text-sm" : "mt-1 text-sm"
              )}
            >
              Analyze one company at a time with a focused AI interface for summaries, findings, pricing, competitors, and follow-up questions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isProcessing ? "info" : "success"} className="hidden normal-case tracking-normal sm:inline-flex">
              <Activity className="mr-1 h-3.5 w-3.5" />
              {isProcessing ? "Agents running" : "Ready"}
            </Badge>
            <ThemeToggle />
          </div>
        </div>
        <ProductContextBar product={product} onUpdate={onUpdate} compact={compact} />
      </div>
    </header>
  );
}
