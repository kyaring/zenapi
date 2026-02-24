-- Move tip_url from channels to users table
ALTER TABLE users ADD COLUMN tip_url TEXT;
