-- 公益站（同步自 LDOH + 手动添加）
CREATE TABLE IF NOT EXISTS ldoh_sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  api_base_url TEXT NOT NULL,
  api_base_hostname TEXT NOT NULL,
  tags_json TEXT,
  is_visible INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'ldoh',
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ldoh_sites_hostname ON ldoh_sites(api_base_hostname);

-- 站点维护者
CREATE TABLE IF NOT EXISTS ldoh_site_maintainers (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  linuxdo_id TEXT,
  approved INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'ldoh',
  UNIQUE(site_id, username)
);
CREATE INDEX IF NOT EXISTS ldoh_maintainers_username ON ldoh_site_maintainers(username);

-- 封禁的 hostname
CREATE TABLE IF NOT EXISTS ldoh_blocked_urls (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  hostname TEXT NOT NULL UNIQUE,
  blocked_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 违规记录
CREATE TABLE IF NOT EXISTS ldoh_violations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  linuxdo_username TEXT,
  attempted_base_url TEXT NOT NULL,
  matched_hostname TEXT NOT NULL,
  site_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ldoh_violations_created ON ldoh_violations(created_at);
