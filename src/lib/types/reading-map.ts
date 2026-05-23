export interface ReadingMapStep {
  order: number;
  title: string;
  description: string;
  focus_question: string;
  look_for?: string[];
  document_targets?: Array<{
    source_title: string;
    page_index?: number;
    excerpt_hint: string;
    why: string;
  }>;
  suggested_reading?: {
    title: string;
    url: string;
    why: string;
  };
}

export interface ReadingPath {
  id: string;
  learning_objective_id: string;
  workspace_id: string;
  steps: ReadingMapStep[];
  generator: string;
  semiont_reranked: boolean;
  latency_ms: number | null;
  created_at: string;
}
