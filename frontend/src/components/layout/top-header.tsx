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
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/5 text-primary shrink-0 border border-border/40">
            <Sparkles className="h-4 w-4" />
          </div>
          
          <div className="flex flex-col min-w-0">
            <h1 className="text-[14px] font-semibold tracking-tight truncate flex items-center gap-2">
              {product.name}
              {isProcessing && (
                <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {useMock && (
            <Badge variant="default" className="h-5 px-2 text-[9px] font-bold tracking-widest bg-amber-500/10 text-amber-600 border-amber-500/20">
              Demo
            </Badge>
          )}
          <div className="h-4 w-px bg-border/60 mx-1" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
