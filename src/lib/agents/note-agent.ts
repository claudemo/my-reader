import type {
  Annotation,
  EvidenceRole,
  ExcerptCard,
  Note,
  Objective,
  Reflection,
  Source,
} from "@/lib/types";
import { gatherSemiontContext } from "@/lib/semiont/client";
import { completeJson, getActiveProvider } from "@/lib/llm/client";

function extractConcepts(text: string, objective: string): string[] {
  const words = `${text} ${objective}`.toLowerCase();
  const candidates = [
    "self-attention",
    "transformer",
    "multi-head attention",
    "positional encoding",
    "scaled dot-product",
    "durable execution",
    "agent runtime",
    "checkpoint",
    "workflow",
    "replay",
    "encoder-decoder",
    "parallelization",
  ];
  return candidates.filter((c) => words.includes(c) || words.includes(c.split(" ")[0])).slice(0, 4);
}

function inferEvidenceRole(text: string): EvidenceRole {
  const lower = text.toLowerCase();
  if (lower.includes("example") || lower.includes("for instance")) return "example";
  if (lower.includes("warning") || lower.includes("should not")) return "warning";
  if (lower.includes("like ") || lower.includes("analogy")) return "analogy";
  if (lower.includes("implement") || lower.includes("pattern")) return "implementation detail";
  if (lower.includes("contradict") || lower.includes("however")) return "contradiction";
  return "definition";
}

export async function generateExcerptCard(
  annotation: Annotation,
  source: Source,
  objective: Objective
): Promise<Omit<ExcerptCard, "id" | "annotation_id" | "created_at">> {
  const semiontContext = source.semiont_resource_id
    ? await gatherSemiontContext(source.semiont_resource_id, annotation.selected_text)
    : null;

  const concepts = extractConcepts(
    `${annotation.selected_text} ${semiontContext ?? ""}`,
    objective.title
  );

  const evidenceRole = inferEvidenceRole(annotation.selected_text);

  if (getActiveProvider() !== "none") {
    const llm = await completeJson<{
      relevance_to_objective: string;
      key_claim: string;
      evidence_role: EvidenceRole;
      concepts: string[];
      application: string;
      open_question: string;
    }>({
      system:
        "You are NoteAgent for MyReader. Generate structured learning notes from reading highlights. Use Semiont-style semantic tagging.",
      user: `Objective: ${objective.title}\nOutput intent: ${objective.output_intent}\nSource: ${source.title}\nHighlight: ${annotation.selected_text}\nContext: ${annotation.surrounding_context}\nUser comment: ${annotation.user_comment ?? "none"}`,
      sessionId: objective.trace_id,
      agentName: "AnnotationAgent",
    });
    if (llm) {
      return {
        relevance_to_objective: llm.relevance_to_objective,
        key_claim: llm.key_claim,
        evidence_role: llm.evidence_role ?? evidenceRole,
        confidence: 0.9,
        concepts: llm.concepts?.length ? llm.concepts : concepts.length ? concepts : ["learning"],
        application: llm.application,
        open_question: llm.open_question,
      };
    }
  }

  return {
    relevance_to_objective: `This passage supports "${objective.title}" by explaining ${evidenceRole === "definition" ? "a foundational concept" : "a concrete aspect"} you need for ${objective.output_intent}.${semiontContext ? ` Semiont graph context: ${semiontContext.slice(0, 200)}…` : ""}`,
    key_claim: annotation.selected_text.split(/[.!?]/)[0]?.trim().slice(0, 200) || annotation.selected_text.slice(0, 200),
    evidence_role: evidenceRole,
    confidence: 0.82,
    concepts: concepts.length ? concepts : ["learning", "reading evidence"],
    application: `Use this when designing ${objective.output_intent.toLowerCase()} — treat each agent step as a durable checkpoint.`,
    open_question: `How would you apply "${concepts[0] ?? "this idea"}" in a real agent project within a week?`,
  };
}

export async function generateNote(
  annotation: Annotation,
  card: Omit<ExcerptCard, "id" | "annotation_id" | "created_at">,
  objective: Objective,
  source: Source
): Promise<Omit<Note, "id" | "annotation_id" | "created_at">> {
  return {
    claim: card.key_claim,
    explanation: `${card.key_claim} In the context of "${source.title}", this matters because ${card.relevance_to_objective}`,
    analogy: `Like bookmarking a page in a textbook, durable execution lets an agent resume exactly where it left off instead of re-reading from chapter one.`,
    application: card.application,
    open_question: card.open_question,
    concepts: card.concepts,
  };
}

export async function generateReflectionPrompts(
  objective: Objective,
  notes: Note[]
): Promise<string[]> {
  const conceptNames = [...new Set(notes.flatMap((n) => n.concepts))].slice(0, 3);
  return [
    `What changed in your understanding of "${objective.title}" after these ${notes.length} highlights?`,
    conceptNames.length
      ? `Which concept — ${conceptNames.join(", ")} — feels most actionable now?`
      : "Which highlight surprised you most?",
    `What would you build differently in an agent project based on this reading?`,
  ];
}

export function synthesizeReflection(
  objective: Objective,
  userResponse: string,
  notes: Note[]
): string {
  const claims = notes.slice(0, 3).map((n) => n.claim).join("; ");
  return `Reflection on "${objective.title}": ${userResponse.trim()} Connected evidence: ${claims}. The learner is moving from highlight collection toward applied understanding.`;
}

export async function generatePublishedPost(
  objective: Objective,
  sources: Source[],
  annotations: Annotation[],
  notes: Note[],
  reflection: Reflection | null
): Promise<{ title: string; content: string; cited_sources: string[] }> {
  const title = `What I learned about ${objective.title}`;

  const keyClaims = notes.map(
    (note, i) =>
      `${i + 1}. **${note.claim}** — cited from highlight: "${annotations.find((a) => a.id === note.annotation_id)?.selected_text.slice(0, 80)}…" [^${i + 1}]`
  );

  const content = `# ${title}

## Summary
${objective.description}

## Key claims
${keyClaims.join("\n")}

## Reflection
${reflection?.user_response ?? "_(No reflection yet)_"}

${reflection?.agent_synthesis ? `\n> ${reflection.agent_synthesis}` : ""}

## Applications
${notes.map((n) => `- ${n.application}`).join("\n")}

## Sources
${sources.map((s, i) => `[^${i + 1}]: [${s.title}](${s.url})`).join("\n")}
`;

  return {
    title,
    content,
    cited_sources: sources.map((s) => s.url),
  };
}