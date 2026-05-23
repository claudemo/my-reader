import type { ReadingMapStep } from "@/lib/types/reading-map";
import type { LearningObjective } from "@/lib/types/learning-objective";
import type { Source } from "@/lib/types";
import {
  summarizeDocumentContext,
  type DocumentPassage,
} from "@/lib/agents/document-context";
import { searchSources } from "@/lib/agents/source-agent";
import { completeJson, getActiveProvider } from "@/lib/llm/client";

function preview(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max).trim()}…`;
}

function chunkPassages(passages: DocumentPassage[], count: number): DocumentPassage[][] {
  if (passages.length === 0) return Array.from({ length: count }, () => []);
  const chunkSize = Math.max(1, Math.ceil(passages.length / count));
  const chunks: DocumentPassage[][] = [];

  for (let i = 0; i < count; i++) {
    chunks.push(passages.slice(i * chunkSize, (i + 1) * chunkSize));
  }

  return chunks;
}

function targetsFromPassages(passages: DocumentPassage[]) {
  return passages.map((passage) => ({
    source_title: passage.source_title,
    page_index: passage.page_index,
    excerpt_hint: preview(passage.text),
    why: "Matched to your learning objective",
  }));
}

function documentAwareTemplateSteps(
  objective: Pick<LearningObjective, "title" | "description" | "output_intent">,
  sources: Source[],
  passages: DocumentPassage[]
): ReadingMapStep[] {
  const primary = sources[0];
  const chunks = chunkPassages(passages, 4);
  const totalPages = sources.reduce((sum, source) => sum + (source.total_pages ?? 1), 0);

  const introPassages = passages.filter((p) => p.page_index <= 1).slice(0, 2);
  const corePassages = chunks[1] ?? passages.slice(2, 5);
  const evidencePassages = chunks[2] ?? passages.slice(5, 8);
  const reviewPassages = chunks[3] ?? passages.slice(-3);

  return [
    {
      order: 1,
      title: "Orient in the document",
      description: primary
        ? `Skim the opening of ${primary.title} (${totalPages} pages) and locate the sections tied to your goal.`
        : "Upload your source first, then regenerate the map to get document-specific steps.",
      focus_question: "What parts of this document seem most relevant to my goal?",
      look_for: introPassages.length
        ? introPassages.map((p) => `Page ${p.page_index + 1}: ${preview(p.text, 120)}`)
        : ["Introduction", "Overview", "Problem statement"],
      document_targets: targetsFromPassages(introPassages),
    },
    {
      order: 2,
      title: "Read the core sections",
      description: "Focus on the passages most aligned with your objective before reading everything.",
      focus_question: "What is the central idea I need from these sections?",
      look_for: corePassages.map((p) => `Page ${p.page_index + 1}: ${preview(p.text, 120)}`),
      document_targets: targetsFromPassages(corePassages),
    },
    {
      order: 3,
      title: "Highlight supporting evidence",
      description:
        "Select the sentences you would cite while explaining this topic to someone else.",
      focus_question: "Which lines directly support my learning objective?",
      look_for: evidencePassages.map((p) => `Page ${p.page_index + 1}: ${preview(p.text, 120)}`),
      document_targets: targetsFromPassages(evidencePassages),
    },
    {
      order: 4,
      title: "Connect and challenge",
      description:
        "Look for limitations, examples, or contrasting claims that refine your understanding.",
      focus_question: "What nuance or counterpoint did I miss on the first pass?",
      look_for: reviewPassages.map((p) => `Page ${p.page_index + 1}: ${preview(p.text, 120)}`),
      document_targets: targetsFromPassages(reviewPassages),
    },
    {
      order: 5,
      title: "Review against your goal",
      description: `Check whether your highlights answer: ${objective.title}`,
      focus_question: `Can I explain "${objective.title}" using only my highlighted passages?`,
      look_for: ["Re-read your strongest highlights in order", "Fill any gaps with one more targeted pass"],
      document_targets: targetsFromPassages(reviewPassages.slice(0, 2)),
    },
  ];
}

function genericTemplateSteps(
  objective: Pick<LearningObjective, "title" | "description" | "output_intent">,
  sources: Array<{ title: string; url: string; relevance_reason: string }>
): ReadingMapStep[] {
  const primary = sources[0];

  return [
    {
      order: 1,
      title: "Add your source",
      description:
        "Upload a PDF or import a URL first. The map will analyze the document and point you to the exact sections to read.",
      focus_question: "What document am I learning from?",
      look_for: ["Primary source file or article URL"],
    },
    {
      order: 2,
      title: "Define the target sections",
      description: `Once the book is attached, regenerate this map to extract passages related to: ${objective.description}`,
      focus_question: "Which parts of the document matter most for my goal?",
      look_for: ["Definitions", "Core argument", "Examples", "Takeaways"],
      suggested_reading: primary
        ? { title: primary.title, url: primary.url, why: primary.relevance_reason }
        : undefined,
    },
    {
      order: 3,
      title: "Highlight evidence",
      description: "Save excerpts from the suggested sections into Notes.",
      focus_question: "Which sentences would I cite if explaining this to someone else?",
      look_for: ["Direct quotes", "Definitions", "Examples"],
    },
  ];
}

export async function generateReadingMap(
  objective: Pick<LearningObjective, "title" | "description" | "output_intent">,
  options?: {
    workspaceSources?: Source[];
    trace?: { sessionId?: string };
  }
): Promise<{
  steps: ReadingMapStep[];
  generator: string;
  semiont_reranked: boolean;
}> {
  const workspaceSources = options?.workspaceSources ?? [];
  const docContext =
    workspaceSources.length > 0
      ? summarizeDocumentContext(workspaceSources, `${objective.title}\n${objective.description}`)
      : null;

  const webSources = await searchSources(objective.title, objective.description);

  if (getActiveProvider() !== "none") {
    const llm = await completeJson<{ steps: ReadingMapStep[] }>({
      system:
        "You are ReadingMapAgent for MyReader. Build a reading map from the learner's objective and the attached document passages. Each step must say what to look for in the document, not generic study advice.",
      user: JSON.stringify({
        objective: {
          title: objective.title,
          description: objective.description,
          output_intent: objective.output_intent,
        },
        attached_documents: workspaceSources.map((source) => ({
          title: source.title,
          source_type: source.source_type,
          total_pages: source.total_pages ?? 1,
        })),
        document_passages: docContext?.passages.map((passage) => ({
          source_title: passage.source_title,
          page_index: passage.page_index,
          excerpt: preview(passage.text, 260),
          score: passage.score,
        })),
        document_outline: docContext?.outline.slice(0, 12),
        candidate_web_sources: webSources.slice(0, 3).map((s) => ({
          title: s.title,
          url: s.url,
          why: s.relevance_reason,
        })),
        rules: [
          "Return 4-6 steps with order 1..n",
          "Each step needs title, description, focus_question, look_for (array of short strings)",
          "When document_passages exist, each step must include document_targets with source_title, page_index, excerpt_hint, why",
          "Point the learner to concrete parts of the attached document",
          "Use page_index as zero-based page numbers from the provided passages",
        ],
      }),
      maxTokens: 1400,
      sessionId: options?.trace?.sessionId,
      agentName: "ReadingMapAgent",
    });

    if (llm?.steps?.length) {
      return {
        steps: llm.steps
          .map((step, i) => ({
            ...step,
            order: step.order ?? i + 1,
            look_for: step.look_for ?? [],
            document_targets: step.document_targets ?? [],
          }))
          .sort((a, b) => a.order - b.order),
        generator: getActiveProvider(),
        semiont_reranked: false,
      };
    }
  }

  if (workspaceSources.length > 0 && docContext) {
    return {
      steps: documentAwareTemplateSteps(objective, workspaceSources, docContext.passages),
      generator: "template+document",
      semiont_reranked: false,
    };
  }

  return {
    steps: genericTemplateSteps(objective, webSources),
    generator: "template",
    semiont_reranked: false,
  };
}
