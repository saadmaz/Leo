import { Badge } from "@/components/ui/badge";

interface ConfidenceBadgeProps {
  confidence: "high" | "medium" | "low";
}

export default function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const variant = confidence === "high" ? "success" : confidence === "medium" ? "warning" : "danger";
  return <Badge variant={variant}>{confidence}</Badge>;
}
