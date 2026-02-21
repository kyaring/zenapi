ALTER TABLE channels ADD COLUMN api_format TEXT NOT NULL DEFAULT 'openai';
ALTER TABLE channels ADD COLUMN custom_headers_json TEXT;
