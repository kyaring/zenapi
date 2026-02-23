ALTER TABLE model_aliases ADD COLUMN alias_only INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS usage_logs_channel_id ON usage_logs(channel_id);
