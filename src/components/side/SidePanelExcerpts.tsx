import { ExportMarkdownButton } from "@/components/export/ExportMarkdownButton";

export function SidePanelExcerpts({
  workspaceId,
  learningObjectiveId,
  cards,
  notes,
  annotations = [],
}: {
  workspaceId: string;
  learningObjectiveId?: string | null;
  cards: Array<{
    id: string;
    annotation_id: string;
    key_claim: string;
    relevance_to_objective: string;
    evidence_role: string;
    concepts: string[];
  }>;
  notes: Array<{ id: string; annotation_id: string; claim: string; explanation?: string }>;
  annotations?: Array<{ id: string; annotation_id?: string; selected_text: string; user_comment: string | null }>;
}) {
  if (cards.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-stone-500">
          No highlights yet. Select text in the reader and save a highlight.
        </p>
        <ExportMarkdownButton
          workspaceId={workspaceId}
          learningObjectiveId={learningObjectiveId}
          scope="notes"
          compact
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ExportMarkdownButton
        workspaceId={workspaceId}
        learningObjectiveId={learningObjectiveId}
        scope="notes"
        compact
      />
      <ul className="space-y-4">
      {cards.map((card, i) => {
        const note = notes.find((n) => n.annotation_id === card.annotation_id);
        const annotation = annotations.find((a) => a.id === card.annotation_id);
        return (
          <li
            key={card.id}
            className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-sm"
          >
            <p className="text-xs font-semibold uppercase text-emerald-800">Highlight {i + 1}</p>
            <p className="mt-1 font-medium text-stone-900">&ldquo;{card.key_claim}&rdquo;</p>
            {annotation?.user_comment && (
              <p className="mt-2 text-xs text-stone-700">
                <span className="font-medium">Your note:</span> {annotation.user_comment}
              </p>
            )}
            {!annotation?.user_comment && card.relevance_to_objective && (
              <p className="mt-2 text-xs text-stone-600">{card.relevance_to_objective}</p>
            )}
            {note?.explanation && note.explanation !== card.key_claim && (
              <p className="mt-2 border-t border-emerald-100 pt-2 text-xs text-stone-600">
                {note.explanation}
              </p>
            )}
          </li>
        );
      })}
      </ul>
    </div>
  );
}
