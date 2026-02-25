import { Hono } from "hono";
import type { AppEnv } from "../env";
import { getLdohCookie } from "../services/settings";
import { jsonError } from "../utils/http";
import { nowIso } from "../utils/time";
import { extractHostname } from "../utils/url";

const ldoh = new Hono<AppEnv>();

type LdohApiSite = {
	id: string;
	name: string;
	description?: string;
	api_base_url: string;
	tags?: string[];
	is_visible?: boolean;
	maintainer?: {
		name?: string;
		username?: string;
		linuxdo_id?: string;
	};
};

/**
 * Syncs sites from the LDOH API.
 */
ldoh.post("/sync", async (c) => {
	const cookie = await getLdohCookie(c.env.DB);
	if (!cookie) {
		return jsonError(c, 400, "ldoh_cookie_not_set", "请先在设置中配置 LDOH Cookie");
	}

	let sites: LdohApiSite[];
	try {
		const resp = await fetch("https://ldoh.105117.xyz/api/sites", {
			headers: { Cookie: cookie },
		});
		if (!resp.ok) {
			return jsonError(c, 502, "ldoh_fetch_failed", `LDOH API 返回 ${resp.status}`);
		}
		const data = await resp.json() as { data?: LdohApiSite[] } | LdohApiSite[];
		sites = Array.isArray(data) ? data : (data as { data?: LdohApiSite[] }).data ?? [];
	} catch (error) {
		return jsonError(c, 502, "ldoh_fetch_error", `无法连接 LDOH: ${(error as Error).message}`);
	}

	const now = nowIso();
	let syncedSites = 0;
	let syncedMaintainers = 0;

	for (const site of sites) {
		if (!site.api_base_url) continue;
		const hostname = extractHostname(site.api_base_url);
		if (!hostname) continue;

		const siteId = site.id || crypto.randomUUID();

		await c.env.DB.prepare(
			`INSERT INTO ldoh_sites (id, name, description, api_base_url, api_base_hostname, tags_json, is_visible, source, synced_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 'ldoh', ?)
			 ON CONFLICT(id) DO UPDATE SET
			   name = excluded.name,
			   description = excluded.description,
			   api_base_url = excluded.api_base_url,
			   api_base_hostname = excluded.api_base_hostname,
			   tags_json = excluded.tags_json,
			   is_visible = excluded.is_visible,
			   synced_at = excluded.synced_at`,
		)
			.bind(
				siteId,
				site.name || "Unknown",
				site.description || null,
				site.api_base_url,
				hostname,
				site.tags ? JSON.stringify(site.tags) : null,
				site.is_visible === false ? 0 : 1,
				now,
			)
			.run();
		syncedSites++;

		if (site.maintainer?.username) {
			const maintainerId = crypto.randomUUID();
			await c.env.DB.prepare(
				`INSERT INTO ldoh_site_maintainers (id, site_id, name, username, linuxdo_id, approved, source)
				 VALUES (?, ?, ?, ?, ?, 1, 'ldoh')
				 ON CONFLICT(site_id, username) DO UPDATE SET
				   name = excluded.name,
				   linuxdo_id = excluded.linuxdo_id,
				   approved = 1,
				   source = 'ldoh'`,
			)
				.bind(
					maintainerId,
					siteId,
					site.maintainer.name || site.maintainer.username,
					site.maintainer.username,
					site.maintainer.linuxdo_id || null,
				)
				.run();

			// Try to match user_id by linuxdo_username
			const localUser = await c.env.DB.prepare(
				"SELECT id FROM users WHERE linuxdo_username = ?",
			)
				.bind(site.maintainer.username)
				.first<{ id: string }>();

			if (localUser) {
				await c.env.DB.prepare(
					"UPDATE ldoh_site_maintainers SET user_id = ? WHERE site_id = ? AND username = ?",
				)
					.bind(localUser.id, siteId, site.maintainer.username)
					.run();
			}
			syncedMaintainers++;
		}
	}

	return c.json({ ok: true, synced_sites: syncedSites, synced_maintainers: syncedMaintainers });
});

/**
 * Lists all LDOH sites with maintainers, block status, pending channel count, violation count.
 */
ldoh.get("/sites", async (c) => {
	const sitesResult = await c.env.DB.prepare(
		"SELECT * FROM ldoh_sites ORDER BY name",
	).all();
	const sites = sitesResult.results ?? [];

	const maintainersResult = await c.env.DB.prepare(
		"SELECT * FROM ldoh_site_maintainers ORDER BY username",
	).all();
	const maintainers = maintainersResult.results ?? [];

	const blockedResult = await c.env.DB.prepare(
		"SELECT * FROM ldoh_blocked_urls",
	).all();
	const blocked = blockedResult.results ?? [];

	const pendingResult = await c.env.DB.prepare(
		`SELECT s.id as site_id, COUNT(c.id) as count
		 FROM ldoh_sites s
		 JOIN channels c ON c.status = 'pending'
		 WHERE LOWER(REPLACE(REPLACE(c.base_url, 'https://', ''), 'http://', '')) LIKE '%' || s.api_base_hostname || '%'
		 GROUP BY s.id`,
	).all();
	const pendingMap = new Map<string, number>();
	for (const row of pendingResult.results ?? []) {
		pendingMap.set(String(row.site_id), Number(row.count));
	}

	const violationResult = await c.env.DB.prepare(
		"SELECT site_id, COUNT(*) as count FROM ldoh_violations GROUP BY site_id",
	).all();
	const violationMap = new Map<string, number>();
	for (const row of violationResult.results ?? []) {
		violationMap.set(String(row.site_id), Number(row.count));
	}

	const enriched = sites.map((site) => ({
		...site,
		maintainers: maintainers.filter((m) => m.site_id === site.id),
		blocked: blocked.filter((b) => b.site_id === site.id),
		pending_channels: pendingMap.get(String(site.id)) ?? 0,
		violation_count: violationMap.get(String(site.id)) ?? 0,
	}));

	return c.json({ sites: enriched });
});

/**
 * Lists all violations.
 */
ldoh.get("/violations", async (c) => {
	const result = await c.env.DB.prepare(
		"SELECT * FROM ldoh_violations ORDER BY created_at DESC LIMIT 200",
	).all();
	return c.json({ violations: result.results ?? [] });
});

/**
 * Approves a manually declared maintainer.
 */
ldoh.post("/maintainers/:id/approve", async (c) => {
	const id = c.req.param("id");
	const existing = await c.env.DB.prepare(
		"SELECT id, username FROM ldoh_site_maintainers WHERE id = ?",
	)
		.bind(id)
		.first();

	if (!existing) {
		return jsonError(c, 404, "maintainer_not_found", "maintainer_not_found");
	}

	await c.env.DB.prepare(
		"UPDATE ldoh_site_maintainers SET approved = 1 WHERE id = ?",
	)
		.bind(id)
		.run();

	// Try to match user_id by linuxdo_username
	const localUser = await c.env.DB.prepare(
		"SELECT id FROM users WHERE linuxdo_username = ?",
	)
		.bind(existing.username)
		.first<{ id: string }>();

	if (localUser) {
		await c.env.DB.prepare(
			"UPDATE ldoh_site_maintainers SET user_id = ? WHERE id = ?",
		)
			.bind(localUser.id, id)
			.run();
	}

	return c.json({ ok: true });
});

/**
 * Removes a maintainer.
 */
ldoh.delete("/maintainers/:id", async (c) => {
	const id = c.req.param("id");
	await c.env.DB.prepare("DELETE FROM ldoh_site_maintainers WHERE id = ?")
		.bind(id)
		.run();
	return c.json({ ok: true });
});

/**
 * Approves a pending channel.
 */
ldoh.post("/channels/:channelId/approve", async (c) => {
	const channelId = c.req.param("channelId");
	const channel = await c.env.DB.prepare(
		"SELECT id, status FROM channels WHERE id = ?",
	)
		.bind(channelId)
		.first();

	if (!channel) {
		return jsonError(c, 404, "channel_not_found", "channel_not_found");
	}

	await c.env.DB.prepare(
		"UPDATE channels SET status = 'active', updated_at = ? WHERE id = ?",
	)
		.bind(nowIso(), channelId)
		.run();

	return c.json({ ok: true });
});

/**
 * Rejects a pending channel (deletes it).
 */
ldoh.post("/channels/:channelId/reject", async (c) => {
	const channelId = c.req.param("channelId");
	await c.env.DB.prepare("DELETE FROM channels WHERE id = ?")
		.bind(channelId)
		.run();
	return c.json({ ok: true });
});

export default ldoh;
