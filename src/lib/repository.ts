import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/utils/ids";
import type {
  Annotation,
  Concept,
  EventLog,
  ExcerptCard,
  Note,
  Objective,
  PublishedPost,
  Reflection,
  Source,
} from "@/lib/types";
import type { LearningObjective } from "@/lib/types/learning-objective";
import type { ReadingMapStep, ReadingPath } from "@/lib/types/reading-map";

export function createObjective(input: {
  title: string;
  description: string;
  output_intent: string;
  trace_id: string;
}): Objective {
  const db = getDb();
  const id = newId("obj");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO objectives (id, title, description, output_intent, trace_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.title, input.description, input.output_intent, input.trace_id, now);
  return getObjective(id)!;
}

export function getObjective(id: string): Objective | null {
  return (
    (getDb().prepare("SELECT * FROM objectives WHERE id = ?").get(id) as Objective) ??
    null
  );
}

export function updateObjective(
  id: string,
  input: { title: string; description: string; output_intent: string }
): Objective {
  getDb()
    .prepare(
      `UPDATE objectives SET title = ?, description = ?, output_intent = ? WHERE id = ?`
    )
    .run(input.title, input.description, input.output_intent, id);
  return getObjective(id)!;
}

export function listObjectives(): Objective[] {
  return getDb()
    .prepare("SELECT * FROM objectives ORDER BY created_at DESC")
    .all() as Objective[];
}

export function createSource(
  input: Omit<Source, "id" | "imported_at"> & {
    page_offsets?: string | null;
    total_pages?: number | null;
    content_hash?: string | null;
    byte_size?: number | null;
    file_path?: string | null;
  }
): Source {
  const db = getDb();
  const id = newId("src");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO sources
     (id, objective_id, url, title, author, source_type, text_content, semiont_resource_id, imported_at, page_offsets, total_pages, content_hash, byte_size, file_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.objective_id,
    input.url,
    input.title,
    input.author,
    input.source_type,
    input.text_content,
    input.semiont_resource_id ?? null,
    now,
    input.page_offsets ?? null,
    input.total_pages ?? null,
    input.content_hash ?? null,
    input.byte_size ?? null,
    input.file_path ?? null
  );
  return getSource(id)!;
}

export function getSource(id: string): Source | null {
  return (getDb().prepare("SELECT * FROM sources WHERE id = ?").get(id) as Source) ?? null;
}

export function listSourcesForObjective(objectiveId: string): Source[] {
  return getDb()
    .prepare("SELECT * FROM sources WHERE objective_id = ? ORDER BY imported_at DESC")
    .all(objectiveId) as Source[];
}

export function updateSourceSemiontId(sourceId: string, semiontResourceId: string) {
  getDb()
    .prepare("UPDATE sources SET semiont_resource_id = ? WHERE id = ?")
    .run(semiontResourceId, sourceId);
}

export function createAnnotation(
  input: Omit<Annotation, "id" | "created_at" | "semiont_annotation_id"> & {
    learning_objective_id?: string | null;
    page_index?: number | null;
  }
): Annotation {
  const db = getDb();
  const id = newId("ann");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO annotations
     (id, objective_id, source_id, selected_text, surrounding_context, start_offset, end_offset, annotation_type, user_comment, semiont_annotation_id, learning_objective_id, page_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.objective_id,
    input.source_id,
    input.selected_text,
    input.surrounding_context,
    input.start_offset,
    input.end_offset,
    input.annotation_type,
    input.user_comment ?? null,
    null,
    input.learning_objective_id ?? null,
    input.page_index ?? null,
    now
  );
  return getAnnotation(id)!;
}

export function getAnnotation(id: string): Annotation | null {
  return (
    (getDb().prepare("SELECT * FROM annotations WHERE id = ?").get(id) as Annotation) ??
    null
  );
}

export function updateAnnotationSemiontId(annotationId: string, semiontId: string) {
  getDb()
    .prepare("UPDATE annotations SET semiont_annotation_id = ? WHERE id = ?")
    .run(semiontId, annotationId);
}

export function listAnnotationsForObjective(objectiveId: string): Annotation[] {
  return getDb()
    .prepare("SELECT * FROM annotations WHERE objective_id = ? ORDER BY created_at ASC")
    .all(objectiveId) as Annotation[];
}

export function createExcerptCard(
  annotationId: string,
  card: Omit<ExcerptCard, "id" | "annotation_id" | "created_at">
): ExcerptCard {
  const db = getDb();
  const id = newId("card");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO excerpt_cards
     (id, annotation_id, relevance_to_objective, key_claim, evidence_role, confidence, concepts, application, open_question, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    annotationId,
    card.relevance_to_objective,
    card.key_claim,
    card.evidence_role,
    card.confidence,
    JSON.stringify(card.concepts),
    card.application,
    card.open_question,
    now
  );
  return getExcerptCardByAnnotation(annotationId)!;
}

export function getExcerptCardByAnnotation(annotationId: string): ExcerptCard | null {
  const row = getDb()
    .prepare("SELECT * FROM excerpt_cards WHERE annotation_id = ?")
    .get(annotationId) as (ExcerptCard & { concepts: string }) | undefined;
  if (!row) return null;
  return { ...row, concepts: JSON.parse(row.concepts) };
}

export function createNote(
  annotationId: string,
  note: Omit<Note, "id" | "annotation_id" | "created_at">
): Note {
  const db = getDb();
  const id = newId("note");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO notes (id, annotation_id, claim, explanation, analogy, application, open_question, concepts, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    annotationId,
    note.claim,
    note.explanation,
    note.analogy,
    note.application,
    note.open_question,
    JSON.stringify(note.concepts),
    now
  );
  upsertConcepts(note.concepts, annotationId);
  return getNoteByAnnotation(annotationId)!;
}

export function getNoteByAnnotation(annotationId: string): Note | null {
  const row = getDb()
    .prepare("SELECT * FROM notes WHERE annotation_id = ?")
    .get(annotationId) as (Note & { concepts: string }) | undefined;
  if (!row) return null;
  return { ...row, concepts: JSON.parse(row.concepts) };
}

export function listNotesForObjective(objectiveId: string): Note[] {
  const rows = getDb()
    .prepare(
      `SELECT n.* FROM notes n
       JOIN annotations a ON a.id = n.annotation_id
       WHERE a.objective_id = ?
       ORDER BY n.created_at ASC`
    )
    .all(objectiveId) as (Note & { concepts: string })[];
  return rows.map((r) => ({ ...r, concepts: JSON.parse(r.concepts) }));
}

function upsertConcepts(names: string[], annotationId: string) {
  const db = getDb();
  const now = new Date().toISOString();
  for (const name of names) {
    const existing = db
      .prepare("SELECT id FROM concepts WHERE name = ?")
      .get(name) as { id: string } | undefined;
    const conceptId = existing?.id ?? newId("concept");
    if (!existing) {
      db.prepare(
        "INSERT INTO concepts (id, name, description, created_at) VALUES (?, ?, ?, ?)"
      ).run(conceptId, name, `Concept from reading: ${name}`, now);
    }
    db.prepare(
      `INSERT INTO concept_links (id, concept_id, annotation_id, relation_type, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(newId("link"), conceptId, annotationId, "evidence_for", now);
  }
}

export function listConceptsForObjective(objectiveId: string): Concept[] {
  return getDb()
    .prepare(
      `SELECT DISTINCT c.* FROM concepts c
       JOIN concept_links cl ON cl.concept_id = c.id
       JOIN annotations a ON a.id = cl.annotation_id
       WHERE a.objective_id = ?
       ORDER BY c.name`
    )
    .all(objectiveId) as Concept[];
}

export function createReflection(input: Omit<Reflection, "id" | "created_at">): Reflection {
  const db = getDb();
  const id = newId("refl");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO reflections (id, objective_id, prompt, user_response, agent_synthesis, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.objective_id,
    input.prompt,
    input.user_response,
    input.agent_synthesis,
    now
  );
  return {
    id,
    ...input,
    created_at: now,
  };
}

function getReflection(objectiveId: string): Reflection | null {
  return (
    (getDb()
      .prepare(
        "SELECT * FROM reflections WHERE objective_id = ? ORDER BY created_at DESC LIMIT 1"
      )
      .get(objectiveId) as Reflection) ?? null
  );
}

export function getReflectionForObjective(objectiveId: string): Reflection | null {
  return getReflection(objectiveId);
}

export function createPublishedPost(
  input: Omit<PublishedPost, "id" | "created_at">
): PublishedPost {
  const db = getDb();
  const id = newId("post");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO published_posts (id, objective_id, title, content, public_url, cited_sources, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.objective_id,
    input.title,
    input.content,
    input.public_url,
    typeof input.cited_sources === "string"
      ? input.cited_sources
      : JSON.stringify(input.cited_sources),
    now
  );
  return {
    id,
    ...input,
    created_at: now,
  };
}

function getPublishedPost(objectiveId: string): PublishedPost | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM published_posts WHERE objective_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(objectiveId) as (PublishedPost & { cited_sources: string }) | undefined;
  if (!row) return null;
  return { ...row, cited_sources: JSON.parse(row.cited_sources) as unknown as string };
}

export function getPublishedPostForObjective(objectiveId: string): PublishedPost | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM published_posts WHERE objective_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(objectiveId) as (PublishedPost & { cited_sources: string }) | undefined;
  if (!row) return null;
  return {
    ...row,
    cited_sources: typeof row.cited_sources === "string" ? row.cited_sources : JSON.stringify(row.cited_sources),
  };
}

export function listEventsForObjective(objectiveId: string): EventLog[] {
  return getDb()
    .prepare("SELECT * FROM event_logs WHERE objective_id = ? ORDER BY created_at ASC")
    .all(objectiveId) as EventLog[];
}

export function getTraceData(objectiveId: string) {
  const objective = getObjective(objectiveId);
  if (!objective) return null;

  const sources = listSourcesForObjective(objectiveId);
  const annotations = listAnnotationsForObjective(objectiveId);
  const notes = listNotesForObjective(objectiveId);
  const cards = annotations
    .map((a) => getExcerptCardByAnnotation(a.id))
    .filter(Boolean) as ExcerptCard[];
  const concepts = listConceptsForObjective(objectiveId);
  const reflection = getReflectionForObjective(objectiveId);
  const post = getPublishedPostForObjective(objectiveId);
  const events = listEventsForObjective(objectiveId);

  return {
    objective,
    sources,
    annotations,
    excerpt_cards: cards,
    notes,
    concepts,
    reflection,
    published_post: post,
    events,
  };
}

function objectiveId(id: string) {
  return id;
}

export function listExcerptCardsForObjective(objectiveId: string): ExcerptCard[] {
  return getDb()
    .prepare(
      `SELECT ec.* FROM excerpt_cards ec
       JOIN annotations a ON a.id = ec.annotation_id
       WHERE a.objective_id = ?
       ORDER BY ec.created_at ASC`
    )
    .all(objectiveId)
    .map((row) => {
      const r = row as ExcerptCard & { concepts: string };
      return { ...r, concepts: JSON.parse(r.concepts) };
    });
}

export function listAnnotationsForLearningObjective(learningObjectiveId: string): Annotation[] {
  return getDb()
    .prepare(
      "SELECT * FROM annotations WHERE learning_objective_id = ? ORDER BY created_at ASC"
    )
    .all(learningObjectiveId) as Annotation[];
}

export function listExcerptCardsForLearningObjective(learningObjectiveId: string): ExcerptCard[] {
  return getDb()
    .prepare(
      `SELECT ec.* FROM excerpt_cards ec
       JOIN annotations a ON a.id = ec.annotation_id
       WHERE a.learning_objective_id = ?
       ORDER BY ec.created_at ASC`
    )
    .all(learningObjectiveId)
    .map((row) => {
      const r = row as ExcerptCard & { concepts: string };
      return { ...r, concepts: JSON.parse(r.concepts) };
    });
}

export function listNotesForLearningObjective(learningObjectiveId: string): Note[] {
  const rows = getDb()
    .prepare(
      `SELECT n.* FROM notes n
       JOIN annotations a ON a.id = n.annotation_id
       WHERE a.learning_objective_id = ?
       ORDER BY n.created_at ASC`
    )
    .all(learningObjectiveId) as Array<Note & { concepts: string }>;
  return rows.map((row) => ({ ...row, concepts: JSON.parse(row.concepts) }));
}

export function createLearningObjective(input: {
  workspace_id: string;
  title: string;
  description: string;
  output_intent: string;
}): LearningObjective {
  const db = getDb();
  const id = newId("lobj");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO learning_objectives (id, workspace_id, title, description, output_intent, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.workspace_id, input.title, input.description, input.output_intent, now);
  return getLearningObjective(id)!;
}

export function getLearningObjective(id: string): LearningObjective | null {
  const row = getDb()
    .prepare("SELECT * FROM learning_objectives WHERE id = ?")
    .get(id) as LearningObjective | undefined;
  return row ?? null;
}

export function listLearningObjectivesForWorkspace(workspaceId: string): LearningObjective[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM learning_objectives WHERE workspace_id = ? ORDER BY created_at ASC"
    )
    .all(workspaceId) as LearningObjective[];

  return rows.map((row) => ({
    ...row,
    has_map: Boolean(getLatestReadingPathForLearningObjective(row.id)),
  }));
}

export function updateLearningObjective(
  id: string,
  input: { title: string; description: string; output_intent: string }
): LearningObjective {
  getDb()
    .prepare(
      `UPDATE learning_objectives SET title = ?, description = ?, output_intent = ? WHERE id = ?`
    )
    .run(input.title, input.description, input.output_intent, id);
  return getLearningObjective(id)!;
}

export function deleteLearningObjective(id: string): boolean {
  const db = getDb();
  const lo = getLearningObjective(id);
  if (!lo) return false;

  const annotationIds = (
    db.prepare("SELECT id FROM annotations WHERE learning_objective_id = ?").all(id) as Array<{
      id: string;
    }>
  ).map((row) => row.id);

  db.transaction(() => {
    if (annotationIds.length) {
      const placeholders = annotationIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM concept_links WHERE annotation_id IN (${placeholders})`).run(
        ...annotationIds
      );
      db.prepare(`DELETE FROM notes WHERE annotation_id IN (${placeholders})`).run(...annotationIds);
      db.prepare(`DELETE FROM excerpt_cards WHERE annotation_id IN (${placeholders})`).run(
        ...annotationIds
      );
      db.prepare("DELETE FROM annotations WHERE learning_objective_id = ?").run(id);
    }
    db.prepare("DELETE FROM reading_paths WHERE learning_objective_id = ?").run(id);
    db.prepare("DELETE FROM learning_objectives WHERE id = ?").run(id);
  })();

  return true;
}

export function hasReadingMapInWorkspace(workspaceId: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM reading_paths rp
       JOIN learning_objectives lo ON lo.id = rp.learning_objective_id
       WHERE lo.workspace_id = ?
       LIMIT 1`
    )
    .get(workspaceId);
  if (row) return true;

  const legacy = getDb()
    .prepare(
      `SELECT 1 FROM reading_paths WHERE objective_id = ? AND learning_objective_id IS NULL LIMIT 1`
    )
    .get(workspaceId);
  return Boolean(legacy);
}

export function getLatestReadingPathForLearningObjective(
  learningObjectiveId: string
): ReadingPath | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM reading_paths WHERE learning_objective_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(learningObjectiveId) as
    | {
        id: string;
        objective_id: string;
        learning_objective_id: string | null;
        steps_json: string;
        generator: string;
        semiont_reranked: number;
        latency_ms: number | null;
        created_at: string;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    learning_objective_id: row.learning_objective_id ?? learningObjectiveId,
    workspace_id: row.objective_id,
    steps: JSON.parse(row.steps_json) as ReadingMapStep[],
    generator: row.generator,
    semiont_reranked: Boolean(row.semiont_reranked),
    latency_ms: row.latency_ms,
    created_at: row.created_at,
  };
}

/** @deprecated use getLatestReadingPathForLearningObjective */
export function getLatestReadingPath(objectiveId: string): ReadingPath | null {
  const lo = listLearningObjectivesForWorkspace(objectiveId)[0];
  if (lo) return getLatestReadingPathForLearningObjective(lo.id);
  const row = getDb()
    .prepare(
      `SELECT * FROM reading_paths WHERE objective_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(objectiveId) as
    | {
        id: string;
        objective_id: string;
        learning_objective_id: string | null;
        steps_json: string;
        generator: string;
        semiont_reranked: number;
        latency_ms: number | null;
        created_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    learning_objective_id: row.learning_objective_id ?? row.objective_id,
    workspace_id: row.objective_id,
    steps: JSON.parse(row.steps_json) as ReadingMapStep[],
    generator: row.generator,
    semiont_reranked: Boolean(row.semiont_reranked),
    latency_ms: row.latency_ms,
    created_at: row.created_at,
  };
}

export function saveReadingPath(input: {
  workspace_id: string;
  learning_objective_id: string;
  steps: ReadingMapStep[];
  generator: string;
  semiont_reranked: boolean;
  latency_ms: number | null;
}): ReadingPath {
  const db = getDb();
  const id = newId("rmap");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO reading_paths (id, objective_id, learning_objective_id, steps_json, generator, semiont_reranked, latency_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.workspace_id,
    input.learning_objective_id,
    JSON.stringify(input.steps),
    input.generator,
    input.semiont_reranked ? 1 : 0,
    input.latency_ms,
    now
  );
  return getLatestReadingPathForLearningObjective(input.learning_objective_id)!;
}

export function deleteObjective(objectiveId: string): boolean {
  const db = getDb();
  const objective = getObjective(objectiveId);
  if (!objective) return false;

  for (const source of listSourcesForObjective(objectiveId)) {
    if (!source.file_path) continue;
    try {
      if (fs.existsSync(source.file_path)) fs.unlinkSync(source.file_path);
      const dir = path.dirname(source.file_path);
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch {
      /* best effort file cleanup */
    }
  }

  const annotationIds = (
    db.prepare("SELECT id FROM annotations WHERE objective_id = ?").all(objectiveId) as Array<{
      id: string;
    }>
  ).map((row) => row.id);

  const runDeletes = db.transaction(() => {
    if (annotationIds.length) {
      const placeholders = annotationIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM concept_links WHERE annotation_id IN (${placeholders})`).run(
        ...annotationIds
      );
      db.prepare(`DELETE FROM notes WHERE annotation_id IN (${placeholders})`).run(...annotationIds);
      db.prepare(`DELETE FROM excerpt_cards WHERE annotation_id IN (${placeholders})`).run(
        ...annotationIds
      );
    }
    db.prepare("DELETE FROM annotations WHERE objective_id = ?").run(objectiveId);
    db.prepare("DELETE FROM sources WHERE objective_id = ?").run(objectiveId);
    db.prepare("DELETE FROM reading_paths WHERE objective_id = ?").run(objectiveId);
    db.prepare("DELETE FROM learning_objectives WHERE workspace_id = ?").run(objectiveId);
    db.prepare("DELETE FROM reflections WHERE objective_id = ?").run(objectiveId);
    db.prepare("DELETE FROM published_posts WHERE objective_id = ?").run(objectiveId);
    db.prepare("DELETE FROM event_logs WHERE objective_id = ?").run(objectiveId);
    db.prepare("DELETE FROM objectives WHERE id = ?").run(objectiveId);
  });

  runDeletes();
  return true;
}
