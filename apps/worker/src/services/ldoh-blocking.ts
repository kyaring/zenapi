import { nowIso } from "../utils/time";

/**
 * When a hostname is newly blocked, disable all active channels matching
 * that hostname that were NOT contributed by an approved maintainer of the site.
 * Accepts a single hostname or an array of hostnames.
 */
export async function disableNonMaintainerChannels(
	db: D1Database,
	siteId: string,
	hostname: string | string[],
): Promise<void> {
	const hostnames = Array.isArray(hostname) ? hostname : [hostname];
	const now = nowIso();

	// Get approved maintainer user_ids for this site
	const maintainers = await db
		.prepare(
			"SELECT user_id FROM ldoh_site_maintainers WHERE site_id = ? AND approved = 1 AND user_id IS NOT NULL",
		)
		.bind(siteId)
		.all<{ user_id: string }>();

	const maintainerIds = (maintainers.results ?? []).map((m) => m.user_id);

	for (const h of hostnames) {
		if (maintainerIds.length > 0) {
			const placeholders = maintainerIds.map(() => "?").join(",");
			await db
				.prepare(
					`UPDATE channels SET status = 'disabled', updated_at = ?
					 WHERE status = 'active'
					 AND LOWER(REPLACE(REPLACE(base_url, 'https://', ''), 'http://', '')) LIKE '%' || ? || '%'
					 AND (contributed_by IS NULL OR contributed_by NOT IN (${placeholders}))`,
				)
				.bind(now, h, ...maintainerIds)
				.run();
		} else {
			await db
				.prepare(
					`UPDATE channels SET status = 'disabled', updated_at = ?
					 WHERE status = 'active'
					 AND LOWER(REPLACE(REPLACE(base_url, 'https://', ''), 'http://', '')) LIKE '%' || ? || '%'`,
				)
				.bind(now, h)
				.run();
		}
	}
}
