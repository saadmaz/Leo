// ── Types matching LEO Specification ──

export interface QueryRequest {
  product: string;
  domain: string;
  question: string;
  session_id: string;
}

export interface Finding {
  claim: string;
  sourceIds: string[];
  isFactual: boolean;
  confidence: "low" | "medium" | "high";
}

export interface Source {
  id: string;
  url: string;
  title: string;
  retrievedAt: string;
  credibilityScore: number;
}

export interface Artifact {
  artifact_type: string;
  title: string;
  payload: Record<string, any>;
}

export interface AgentStatusInfo {
  name: string;
  status: "success" | "partial" | "failed" | "running" | "queued" | "completed";
  duration: number;
  message?: string;
}

export interface ConfidenceOverview {
  overall: "high" | "medium" | "low";
  byDomain: Record<string, "high" | "medium" | "low">;
}

export interface FinalResponse {
  executiveSummary: string;
  topOpportunities: string[];
  topRisks: string[];
  recommendedBets: string[];
  findings: Finding[];
  facts: string[];
  interpretations: string[];
  evidence: Source[];
  artifacts: Artifact[];
  confidenceOverview: ConfidenceOverview;
  followUpQuestions: string[];
  agentStatuses: AgentStatusInfo[];
  queryCostEstimate: string;
  errors: string[];
}

export interface ProductContext {
  name: string;
  url: string;
}

// ── Messaging Types ──

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  response?: FinalResponse;
  agentUpdates?: any[]; // For real-time status updates
}
