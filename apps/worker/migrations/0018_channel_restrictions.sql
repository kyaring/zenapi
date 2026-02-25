-- Add stream_only (仅流式) flag and contribution_note to channels
ALTER TABLE channels ADD COLUMN stream_only INTEGER NOT NULL DEFAULT 0;
ALTER TABLE channels ADD COLUMN contribution_note TEXT;
