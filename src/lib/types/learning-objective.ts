export interface LearningObjective {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  output_intent: string;
  created_at: string;
  has_map?: boolean;
}
