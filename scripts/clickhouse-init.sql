CREATE DATABASE IF NOT EXISTS myreader;

CREATE TABLE IF NOT EXISTS myreader.reading_events (
    event_id String,
    trace_id String,
    objective_id String,
    event_type String,
    object_type String,
    object_id String,
    agent_name String,
    concepts Array(String),
    source_url String,
    latency_ms UInt32,
    status String,
    metadata String DEFAULT '{}',
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (objective_id, created_at);

CREATE TABLE IF NOT EXISTS myreader.parsed_doc_cache (
    cache_key String,
    canonical_url Nullable(String),
    source_type String,
    text String,
    page_offsets String,
    total_pages UInt32,
    doc_title String,
    doc_author String,
    byte_size UInt64,
    extraction_version UInt16,
    created_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY cache_key;
