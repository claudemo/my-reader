-- Run once if upgrading from the old readtrace ClickHouse database:
-- docker compose exec clickhouse clickhouse-client --multiquery < scripts/clickhouse-migrate-to-myreader.sql

CREATE DATABASE IF NOT EXISTS myreader;

CREATE TABLE IF NOT EXISTS myreader.reading_events AS readtrace.reading_events;
CREATE TABLE IF NOT EXISTS myreader.parsed_doc_cache
(
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
)
ENGINE = ReplacingMergeTree(created_at)
ORDER BY cache_key;

INSERT INTO myreader.reading_events
SELECT
    object_id AS event_id,
    trace_id,
    objective_id,
    event_type,
    object_type,
    object_id,
    agent_name,
    concepts,
    source_url,
    latency_ms,
    status,
    '{}' AS metadata,
    created_at
FROM readtrace.reading_events;
