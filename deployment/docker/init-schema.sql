CREATE DATABASE IF NOT EXISTS media_catalog;

CREATE TABLE IF NOT EXISTS media_catalog.media_content (
    id String,
    title String,
    description String,
    genre String,
    release_date Date,
    cast Array(String),
    enrichment String,
    language String DEFAULT 'en',
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (id);

CREATE TABLE IF NOT EXISTS media_catalog.title_revenue (
    title_id String,
    title String,
    week_start Date,
    views UInt64,
    revenue_usd Float64
) ENGINE = MergeTree()
ORDER BY (week_start, title_id);

CREATE TABLE IF NOT EXISTS media_catalog.agent_runs (
    id String,
    user_prompt String,
    intent String,
    sql_executed String,
    latency_ms UInt32,
    model String,
    response_summary String,
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (created_at, id);
