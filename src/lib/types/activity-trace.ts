import type { LearningObjective } from "@/lib/types/learning-objective";

export interface ParsedActivityEvent {
  id: string;
  event_type: string;
  label: string;
  agent_name: string | null;
  object_type: string;
  object_id: string;
  latency_ms: number | null;
  status: string;
  created_at: string;
  metadata: Record<string, unknown>;
  learning_objective_id: string | null;
}

export interface ActivityTraceResponse {
  trace_id: string;
  workspace_id: string;
  workspace_title: string;
  learning_objectives: LearningObjective[];
  events: ParsedActivityEvent[];
  summary: {
    total: number;
    by_agent: Record<string, number>;
    by_event_type: Record<string, number>;
  };
  clickhouse_analytics: {
    by_event_type: Array<{ event_type: string; count: string }>;
    by_concept: Array<{ concept: string; count: string }>;
  } | null;
}
