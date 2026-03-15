"use client";

import FollowupChips from "@/components/analysis/followup-chips";

interface Props {
  chips: string[];
  onSelect: (chip: string) => void;
}

export default function SuggestedChips({ chips, onSelect }: Props) {
  return <FollowupChips chips={chips} onSelect={onSelect} />;
}
