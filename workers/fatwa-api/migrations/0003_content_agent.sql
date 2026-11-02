CREATE TABLE IF NOT EXISTS content_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'news',
  language TEXT NOT NULL DEFAULT 'en',
  active INTEGER NOT NULL DEFAULT 1,
  auto_publish INTEGER NOT NULL DEFAULT 0,
  last_fetched_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  source_count INTEGER NOT NULL DEFAULT 0,
  fetched_count INTEGER NOT NULL DEFAULT 0,
  draft_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE TABLE IF NOT EXISTS source_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  published_at TEXT,
  summary TEXT,
  raw_text TEXT,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(source_id, external_id)
);
CREATE TABLE IF NOT EXISTS content_drafts (
  id TEXT PRIMARY KEY,
  source_item_id TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  language TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_published_at TEXT,
  claims_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'needs_review',
  confidence REAL NOT NULL DEFAULT 0,
  ai_model TEXT NOT NULL,
  review_note TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_drafts_status ON content_drafts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_events_run ON agent_events(run_id, created_at);
