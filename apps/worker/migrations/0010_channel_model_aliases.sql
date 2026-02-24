CREATE TABLE IF NOT EXISTS channel_model_aliases (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  alias_only INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS channel_model_aliases_ch_alias ON channel_model_aliases(channel_id, alias);
CREATE INDEX IF NOT EXISTS channel_model_aliases_alias ON channel_model_aliases(alias);
CREATE INDEX IF NOT EXISTS channel_model_aliases_ch_model ON channel_model_aliases(channel_id, model_id);
