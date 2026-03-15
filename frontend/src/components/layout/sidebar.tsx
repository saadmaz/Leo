"use client";

import { BarChart3, Bot, Compass, Layers3, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SidebarProps {
  sessionCost: number;
  queryCost: number;
  hasMessages: boolean;
}

const navItems = [
  { label: "Workspace", icon: Layers3, active: true },
  { label: "Signals", icon: Compass, active: false },
  { label: "Artifacts", icon: BarChart3, active: false },
  { label: "Agents", icon: Bot, active: false },
];

export default function Sidebar({ sessionCost, queryCost, hasMessages }: SidebarProps) {
  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-white/8 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] px-5 py-6 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/12 text-indigo-200 shadow-lg shadow-primary/10">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-100">Leo Intelligence</div>
          <div className="text-xs text-slate-500">Conversational growth workspace</div>
        </div>
      </div>

      <div className="mt-10 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition-colors",
              item.active
                ? "border border-white/10 bg-white/[0.06] text-white"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      <Card className="mt-8 overflow-hidden border-primary/10 bg-[linear-gradient(180deg,rgba(99,102,241,0.14),rgba(15,23,42,0.72))]">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Analysis Mode</p>
              <p className="mt-1 text-sm font-medium text-slate-100">Multi-agent intelligence</p>
            </div>
            <Badge variant="purple">Live</Badge>
          </div>
          <p className="text-sm leading-6 text-slate-300">
            Six specialist agents synthesize market, competitor, pricing, positioning, and risk signals into one workspace.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-auto bg-white/[0.03]">
        <CardContent className="space-y-5 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Session</span>
            <Badge variant={hasMessages ? "success" : "default"}>{hasMessages ? "Active" : "Idle"}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last query</div>
              <div className="mt-2 font-mono text-sm text-slate-100">~${queryCost.toFixed(2)}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Session total</div>
              <div className="mt-2 font-mono text-sm text-slate-100">~${sessionCost.toFixed(2)}</div>
            </div>
          </div>
          <div className="text-xs leading-5 text-slate-500">
            Outputs retain the current backend contract. This pass upgrades layout, hierarchy, and presentation only.
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
