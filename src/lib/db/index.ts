import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "myreader.db");
const LEGACY_DB_PATH = path.join(DATA_DIR, "readtrace.db");

let db: Database.Database | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS objectives (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      output_intent TEXT NOT NULL,
      trace_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      source_type TEXT NOT NULL,
      text_content TEXT NOT NULL,
      semiont_resource_id TEXT,
      imported_at TEXT NOT NULL,
      page_offsets TEXT,
      total_pages INTEGER,
      content_hash TEXT,
      byte_size INTEGER,
      FOREIGN KEY (objective_id) REFERENCES objectives(id)
    );

    CREATE TABLE IF NOT EXISTS pdf_extract_cache (
      content_hash TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      page_offsets TEXT NOT NULL,
      total_pages INTEGER NOT NULL,
      pdf_title TEXT,
      pdf_author TEXT,
      byte_size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parsed_doc_cache (
      cache_key TEXT PRIMARY KEY,
      canonical_url TEXT,
      source_type TEXT NOT NULL,
      text TEXT NOT NULL,
      page_offsets TEXT NOT NULL,
      total_pages INTEGER NOT NULL,
      doc_title TEXT,
      doc_author TEXT,
      byte_size INTEGER NOT NULL,
      extraction_version INTEGER NOT NULL DEFAULT 2,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_parsed_doc_cache_url ON parsed_doc_cache(canonical_url);

    CREATE TABLE IF NOT EXISTS reading_paths (
      id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      generator TEXT NOT NULL,
      semiont_reranked INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (objective_id) REFERENCES objectives(id)
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      selected_text TEXT NOT NULL,
      surrounding_context TEXT NOT NULL,
      start_offset INTEGER NOT NULL,
      end_offset INTEGER NOT NULL,
      annotation_type TEXT NOT NULL,
      user_comment TEXT,
      semiont_annotation_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (objective_id) REFERENCES objectives(id),
      FOREIGN KEY (source_id) REFERENCES sources(id)
    );

    CREATE TABLE IF NOT EXISTS excerpt_cards (
      id TEXT PRIMARY KEY,
      annotation_id TEXT NOT NULL,
      relevance_to_objective TEXT NOT NULL,
      key_claim TEXT NOT NULL,
      evidence_role TEXT NOT NULL,
      confidence REAL NOT NULL,
      concepts TEXT NOT NULL,
      application TEXT NOT NULL,
      open_question TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (annotation_id) REFERENCES annotations(id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      annotation_id TEXT NOT NULL,
      claim TEXT NOT NULL,
      explanation TEXT NOT NULL,
      analogy TEXT NOT NULL,
      application TEXT NOT NULL,
      open_question TEXT NOT NULL,
      concepts TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (annotation_id) REFERENCES annotations(id)
    );

    CREATE TABLE IF NOT EXISTS concepts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS concept_links (
      id TEXT PRIMARY KEY,
      concept_id TEXT NOT NULL,
      annotation_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (concept_id) REFERENCES concepts(id),
      FOREIGN KEY (annotation_id) REFERENCES annotations(id)
    );

    CREATE TABLE IF NOT EXISTS reflections (
      id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      user_response TEXT NOT NULL,
      agent_synthesis TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (objective_id) REFERENCES objectives(id)
    );

    CREATE TABLE IF NOT EXISTS published_posts (
      id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      public_url TEXT NOT NULL,
      cited_sources TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (objective_id) REFERENCES objectives(id)
    );

    CREATE TABLE IF NOT EXISTS event_logs (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      objective_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      object_type TEXT NOT NULL,
      object_id TEXT NOT NULL,
      agent_name TEXT,
      metadata TEXT NOT NULL,
      latency_ms INTEGER,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS anthropic_feed_links (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,
      published_at TEXT,
      fetched_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_anthropic_feed_links_source
      ON anthropic_feed_links(source);
  `);

  migrateSourcesColumns(database);
  migrateLearningObjectives(database);
  migrateParsedDocCache(database);
}

function migrateParsedDocCache(database: Database.Database) {
  database.exec(`
    INSERT OR IGNORE INTO parsed_doc_cache
      (cache_key, canonical_url, source_type, text, page_offsets, total_pages, doc_title, doc_author, byte_size, extraction_version, created_at)
    SELECT content_hash, NULL, 'pdf', text, page_offsets, total_pages, pdf_title, pdf_author, byte_size, 2, created_at
    FROM pdf_extract_cache
  `);
}

function migrateLearningObjectives(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS learning_objectives (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      output_intent TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES objectives(id)
    );
  `);

  const pathCols = database.prepare("PRAGMA table_info(reading_paths)").all() as Array<{ name: string }>;
  if (!pathCols.some((c) => c.name === "learning_objective_id")) {
    database.exec("ALTER TABLE reading_paths ADD COLUMN learning_objective_id TEXT");
  }

  const annCols = database.prepare("PRAGMA table_info(annotations)").all() as Array<{ name: string }>;
  if (!annCols.some((c) => c.name === "learning_objective_id")) {
    database.exec("ALTER TABLE annotations ADD COLUMN learning_objective_id TEXT");
  }
  if (!annCols.some((c) => c.name === "page_index")) {
    database.exec("ALTER TABLE annotations ADD COLUMN page_index INTEGER");
  }

  const workspaces = database.prepare("SELECT * FROM objectives").all() as Array<{
    id: string;
    title: string;
    description: string;
    output_intent: string;
    created_at: string;
  }>;

  for (const ws of workspaces) {
    const count = (
      database
        .prepare("SELECT COUNT(*) as c FROM learning_objectives WHERE workspace_id = ?")
        .get(ws.id) as { c: number }
    ).c;

    if (count > 0) continue;
    if (!ws.description.trim()) continue;

    const loId = `lobj_${ws.id.replace(/^obj_/, "").slice(0, 12)}`;
    database
      .prepare(
        `INSERT INTO learning_objectives (id, workspace_id, title, description, output_intent, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(loId, ws.id, ws.title, ws.description, ws.output_intent, ws.created_at);

    database
      .prepare(
        "UPDATE reading_paths SET learning_objective_id = ? WHERE objective_id = ? AND learning_objective_id IS NULL"
      )
      .run(loId, ws.id);

    database
      .prepare(
        "UPDATE annotations SET learning_objective_id = ? WHERE objective_id = ? AND learning_objective_id IS NULL"
      )
      .run(loId, ws.id);
  }
}

function migrateSourcesColumns(database: Database.Database) {
  const cols = database.prepare("PRAGMA table_info(sources)").all() as Array<{
    name: string;
  }>;
  const has = (name: string) => cols.some((c) => c.name === name);
  if (!has("page_offsets")) database.exec("ALTER TABLE sources ADD COLUMN page_offsets TEXT");
  if (!has("total_pages")) database.exec("ALTER TABLE sources ADD COLUMN total_pages INTEGER");
  if (!has("content_hash")) database.exec("ALTER TABLE sources ADD COLUMN content_hash TEXT");
  if (!has("byte_size")) database.exec("ALTER TABLE sources ADD COLUMN byte_size INTEGER");
  if (!has("file_path")) database.exec("ALTER TABLE sources ADD COLUMN file_path TEXT");
}

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDir();
    if (!fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB_PATH)) {
      fs.copyFileSync(LEGACY_DB_PATH, DB_PATH);
    }
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema(db);
  }
  return db;
}
