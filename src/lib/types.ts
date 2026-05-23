export type EvidenceRole =
  | "definition"
  | "example"
  | "warning"
  | "implementation detail"
  | "contradiction"
  | "analogy";

export interface Objective {
  id: string;
  title: string;
  description: string;
  output_intent: string;
  trace_id: string;
  created_at: string;
}

export interface Source {
  id: string;
  objective_id: string;
  url: string;
  title: string;
  author: string;
  source_type: string;
  text_content: string;
  semiont_resource_id: string | null;
  imported_at: string;
  page_offsets?: string | null;
  total_pages?: number | null;
  content_hash?: string | null;
  byte_size?: number | null;
  file_path?: string | null;
}

export interface Annotation {
  id: string;
  objective_id: string;
  source_id: string;
  selected_text: string;
  surrounding_context: string;
  start_offset: number;
  end_offset: number;
  annotation_type: string;
  user_comment: string | null;
  semiont_annotation_id: string | null;
  learning_objective_id?: string | null;
  page_index?: number | null;
  created_at: string;
}

export interface ExcerptCard {
  id: string;
  annotation_id: string;
  relevance_to_objective: string;
  key_claim: string;
  evidence_role: EvidenceRole;
  confidence: number;
  concepts: string[];
  application: string;
  open_question: string;
  created_at: string;
}

export interface Note {
  id: string;
  annotation_id: string;
  claim: string;
  explanation: string;
  analogy: string;
  application: string;
  open_question: string;
  concepts: string[];
  created_at: string;
}

export interface Concept {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface ConceptLink {
  id: string;
  concept_id: string;
  annotation_id: string;
  relation_type: string;
  created_at: string;
}

export interface Reflection {
  id: string;
  objective_id: string;
  prompt: string;
  user_response: string;
  agent_synthesis: string;
  created_at: string;
}

export interface PublishedPost {
  id: string;
  objective_id: string;
  title: string;
  content: string;
  public_url: string;
  cited_sources: string;
  created_at: string;
}

export interface EventLog {
  id: string;
  trace_id: string;
  objective_id: string;
  event_type: string;
  object_type: string;
  object_id: string;
  agent_name: string | null;
  metadata: string;
  latency_ms: number | null;
  status: string;
  created_at: string;
}

export interface TraceContext {
  trace_id: string;
  objective_id?: string;
  source_id?: string;
  annotation_id?: string;
}

export interface SourceSearchResult {
  title: string;
  url: string;
  snippet: string;
  source_type: string;
  relevance_reason: string;
}

export interface W3CAnnotation {
  "@context": "http://www.w3.org/ns/anno.jsonld";
  id: string;
  type: "Annotation";
  motivation: string;
  body: Array<{ type: string; value: string; purpose?: string }>;
  target: {
    source: string;
    selector: {
      type: "TextPositionSelector";
      start: number;
      end: number;
    };
  };
}
