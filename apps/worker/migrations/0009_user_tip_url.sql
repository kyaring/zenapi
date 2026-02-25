-- Add tip_url to users table (0008 was already applied to channels table)
ALTER TABLE users ADD COLUMN tip_url TEXT;
