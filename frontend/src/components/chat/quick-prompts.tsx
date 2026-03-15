"use client";

import FollowupChips from "@/components/analysis/followup-chips";

interface QuickPromptsProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
  align?: "center" | "left";
}

export default function QuickPrompts({ prompts, onSelect, align = "left" }: QuickPromptsProps) {
  return <FollowupChips chips={prompts} onSelect={onSelect} align={align} />;
}
