CREATE TABLE IF NOT EXISTS daily_post_usage (
  user_id TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  posts INTEGER NOT NULL DEFAULT 0,
  videos INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, usage_date)
);
