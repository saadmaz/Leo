"use client";

import { Activity, Globe, Radar, Sparkles } from "lucide-react";
import { ProductContext } from "@/types";
import { Badge } from "@/components/ui/badge";
import ProductContextBar from "@/components/ProductContextBar";

interface TopbarProps {
  product: ProductContext;
  onUpdate: (product: ProductContext) => void;
  isProcessing: boolean;
  useMock: boolean;
}

export default function Topbar({ product, onUpdate, isProcessing, useMock }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-slate-950/75 backdrop-blur-xl">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="purple" className="gap-1 normal-case tracking-normal">
                <Sparkles className="h-3.5 w-3.5" />
                Intelligence Workspace
              </Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-50">Growth intelligence for {product.name}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Analyze market momentum, positioning, pricing, and competitive movement in a single conversational workspace.
            </p>
          </div>
          <div className="hidden items-center gap-2 xl:flex">
            <Badge variant={isProcessing ? "info" : "default"} className="gap-1 normal-case tracking-normal">
              <Activity className="h-3.5 w-3.5" />
              {isProcessing ? "Agents running" : "Ready"}
            </Badge>
            <Badge variant={useMock ? "warning" : "success"} className="gap-1 normal-case tracking-normal">
              <Radar className="h-3.5 w-3.5" />
              {useMock ? "Demo data" : "API mode"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <ProductContextBar product={product} onUpdate={onUpdate} />
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Globe className="h-3.5 w-3.5" />
            Signals scoped to product, pricing, positioning, and adjacent market movement
          </div>
        </div>
      </div>
    </header>
  );
}
