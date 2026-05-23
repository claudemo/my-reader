import fs from "fs";
import path from "path";
import type {
  Annotation,
  ExcerptCard,
  Note,
  Objective,
  PublishedPost,
  Reflection,
  Source,
} from "@/lib/types";
import type { LearningObjective } from "@/lib/types/learning-objective";
import type { ReadingPath } from "@/lib/types/reading-map";

export type ExportScope = "notes" | "full";

export interface ExportInput {
  workspace: Objective;
  sources: Source[];
  learningObjectives: LearningObjective[];
  annotations: Annotation[];
  excerptCards: ExcerptCard[];
  notes: Note[];
  readingPaths: Array<{ learningObjective: LearningObjective; path: ReadingPath | null }>;
  reflection: Reflection | null;
  publishedPost: PublishedPost | null;
  scope: ExportScope;
  activeLearningObjectiveId?: string | null;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "reading"
  );
}

function escapeInline(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function formatConcepts(concepts: string[]): string {
  if (!concepts.length) return "";
  return concepts.map((c) => `\`${c}\``).join(", ");
}

function formatHighlightBlock(
  index: number,
  annotation: Annotation | undefined,
  card: ExcerptCard | undefined,
  note: Note | undefined,
  sourceTitle?: string
): string {
  const lines: string[] = [`### Highlight ${index + 1}`];

  if (sourceTitle) {
    lines.push(`*Source: ${sourceTitle}*`);
  }

  if (annotation?.page_index != null) {
    lines.push(`*Page ${annotation.page_index + 1}*`);
  }

  if (annotation?.selected_text) {
    lines.push("");
    lines.push(
      annotation.selected_text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")
    );
  }

  if (annotation?.user_comment) {
    lines.push("");
    lines.push(`**Your note:** ${escapeInline(annotation.user_comment)}`);
  }

  if (card?.key_claim) {
    lines.push("");
    lines.push(`**Key claim:** ${escapeInline(card.key_claim)}`);
  }

  if (card?.relevance_to_objective) {
    lines.push(`**Relevance:** ${escapeInline(card.relevance_to_objective)}`);
  }

  if (card?.evidence_role) {
    lines.push(`**Evidence role:** ${card.evidence_role}`);
  }

  if (note?.claim && note.claim !== card?.key_claim) {
    lines.push("");
    lines.push(`**Atomic note:** ${escapeInline(note.claim)}`);
  }

  if (note?.explanation) {
    lines.push("");
    lines.push(escapeInline(note.explanation));
  }

  if (note?.analogy) {
    lines.push("");
    lines.push(`*Analogy:* ${escapeInline(note.analogy)}`);
  }

  if (note?.application || card?.application) {
    lines.push("");
    lines.push(`**Apply:** ${escapeInline(note?.application || card?.application || "")}`);
  }

  if (note?.open_question || card?.open_question) {
    lines.push("");
    lines.push(`**Open question:** ${escapeInline(note?.open_question || card?.open_question || "")}`);
  }

  const concepts = note?.concepts?.length ? note.concepts : card?.concepts ?? [];
  if (concepts.length) {
    lines.push("");
    lines.push(`**Concepts:** ${formatConcepts(concepts)}`);
  }

  lines.push("");
  return lines.join("\n");
}

function buildReadingMapSection(path: ReadingPath | null): string {
  if (!path?.steps?.length) {
    return "_No reading map yet._\n";
  }

  return path.steps
    .map(
      (step) =>
        `${step.order}. **${escapeInline(step.title)}** — ${escapeInline(step.description)}${
          step.focus_question ? `\n   - Focus: ${escapeInline(step.focus_question)}` : ""
        }`
    )
    .join("\n");
}

function filterByLearningObjective<T extends { annotation_id?: string; id?: string }>(
  items: T[],
  annotations: Annotation[],
  learningObjectiveId: string,
  key: "annotation_id" | "id" = "annotation_id"
): T[] {
  const allowed = new Set(
    annotations
      .filter((a) => a.learning_objective_id === learningObjectiveId)
      .map((a) => a.id)
  );

  return items.filter((item) => {
    const annotationId = key === "id" ? item.id : item.annotation_id;
    return annotationId ? allowed.has(annotationId) : false;
  });
}

export function buildMarkdownExport(input: ExportInput): { filename: string; content: string } {
  const exportedAt = new Date().toISOString();
  const sourceById = new Map(input.sources.map((s) => [s.id, s]));
  const cardByAnnotation = new Map(input.excerptCards.map((c) => [c.annotation_id, c]));
  const noteByAnnotation = new Map(input.notes.map((n) => [n.annotation_id, n]));

  let annotations = input.annotations;
  let excerptCards = input.excerptCards;
  let notes = input.notes;
  let learningObjectives = input.learningObjectives;
  let readingPaths = input.readingPaths;

  if (input.activeLearningObjectiveId) {
    const lo = input.learningObjectives.find((o) => o.id === input.activeLearningObjectiveId);
    learningObjectives = lo ? [lo] : [];
    annotations = filterByLearningObjective(input.annotations, input.annotations, input.activeLearningObjectiveId, "id");
    excerptCards = filterByLearningObjective(input.excerptCards, input.annotations, input.activeLearningObjectiveId);
    notes = filterByLearningObjective(input.notes, input.annotations, input.activeLearningObjectiveId);
    readingPaths = readingPaths.filter(
      (entry) => entry.learningObjective.id === input.activeLearningObjectiveId
    );
  }

  const primarySource = input.sources[0];
  const titleBase =
    primarySource?.title ??
    learningObjectives[0]?.description ??
    input.workspace.title ??
    "reading";
  const filenamePrefix =
    input.scope === "full"
      ? `myreader-full-${slugify(titleBase)}`
      : `myreader-notes-${slugify(titleBase)}`;

  const sections: string[] = [
    `# MyReader Export`,
    "",
    `**Book / session:** ${escapeInline(titleBase)}`,
    `**Exported:** ${exportedAt}`,
    `**Workspace ID:** \`${input.workspace.id}\``,
    "",
  ];

  if (input.scope === "full") {
    sections.push("## Sources", "");
    if (input.sources.length === 0) {
      sections.push("_No sources attached._", "");
    } else {
      for (const source of input.sources) {
        sections.push(`- **${escapeInline(source.title)}** (${source.source_type})`);
        if (source.url.startsWith("upload://")) {
          sections.push(`  - Uploaded file`);
        } else {
          sections.push(`  - ${source.url}`);
        }
        if (source.author) {
          sections.push(`  - Author: ${escapeInline(source.author)}`);
        }
      }
      sections.push("");
    }
  }

  if (learningObjectives.length === 0) {
    sections.push("## Highlights", "", "_No learning objectives or highlights yet._", "");
  } else {
    for (const entry of readingPaths.length
      ? readingPaths
      : learningObjectives.map((lo) => ({ learningObjective: lo, path: null as ReadingPath | null }))) {
      const lo = entry.learningObjective;
      const label = lo.description.trim() || lo.title;
      sections.push(`## ${escapeInline(label)}`, "");

      if (input.scope === "full") {
        sections.push("### Reading map", "");
        sections.push(buildReadingMapSection(entry.path));
        sections.push("");
      }

      const loAnnotations = annotations.filter((a) => a.learning_objective_id === lo.id);
      sections.push("### Highlights", "");

      if (loAnnotations.length === 0) {
        sections.push("_No highlights for this objective yet._", "");
        continue;
      }

      loAnnotations.forEach((annotation, index) => {
        const source = sourceById.get(annotation.source_id);
        sections.push(
          formatHighlightBlock(
            index,
            annotation,
            cardByAnnotation.get(annotation.id),
            noteByAnnotation.get(annotation.id),
            source?.title
          )
        );
      });
    }
  }

  if (input.scope === "full") {
    sections.push("## Reflection", "");
    if (input.reflection?.user_response) {
      sections.push(escapeInline(input.reflection.user_response));
      if (input.reflection.agent_synthesis) {
        sections.push("");
        sections.push(`> ${escapeInline(input.reflection.agent_synthesis)}`);
      }
    } else {
      sections.push("_No reflection yet._");
    }
    sections.push("");

    if (input.publishedPost?.content) {
      sections.push("## Published post", "");
      sections.push(input.publishedPost.content.trim());
      sections.push("");
    }
  }

  sections.push("---", "", "_Exported from MyReader._");

  return {
    filename: `${filenamePrefix}.md`,
    content: sections.join("\n"),
  };
}

export function exportsDir(workspaceId: string): string {
  return path.join(process.cwd(), "data", "exports", workspaceId);
}

export function saveMarkdownExport(
  workspaceId: string,
  filename: string,
  content: string
): string {
  const dir = exportsDir(workspaceId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const stamped = filename.replace(/\.md$/i, `-${Date.now()}.md`);
  const filePath = path.join(dir, stamped);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}
