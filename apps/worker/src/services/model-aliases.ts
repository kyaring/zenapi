import type { D1Database } from "@cloudflare/workers-types";
import { nowIso } from "../utils/time";

type AliasRow = {
	id: string;
	model_id: string;
	alias: string;
	is_primary: number;
	alias_only: number;
	created_at: string;
	updated_at: string;
};

export type AliasInput = {
	alias: string;
	is_primary: boolean;
};

/**
 * Returns ALL real model IDs that a given name can route to.
 *
 * Example: user requests "claude-opus-4.6"
 *  - "claude-opus-4.6" itself is always included (may be a real model on some channel)
 *  - If "claude-opus-4.6" is an alias for "claude-opus-4-6", that is also included
 *
 * The result is deduplicated.
 */
export async function resolveModelNames(
	db: D1Database,
	name: string,
): Promise<string[]> {
	const names = [name];
	const row = await db
		.prepare("SELECT model_id FROM model_aliases WHERE alias = ?")
		.bind(name)
		.first<{ model_id: string }>();
	if (row && row.model_id !== name) {
		names.push(row.model_id);
	}
	return names;
}

/**
 * Returns a map of model_id → primary alias name (display name).
 */
export async function loadPrimaryNameMap(
	db: D1Database,
): Promise<Map<string, string>> {
	const result = await db
		.prepare("SELECT model_id, alias FROM model_aliases WHERE is_primary = 1")
		.all<{ model_id: string; alias: string }>();
	const map = new Map<string, string>();
	for (const row of result.results ?? []) {
		map.set(row.model_id, row.alias);
	}
	return map;
}

/**
 * Returns a map of alias → model_id for all aliases.
 */
export async function loadAliasMap(
	db: D1Database,
): Promise<Map<string, string>> {
	const result = await db
		.prepare("SELECT alias, model_id FROM model_aliases")
		.all<{ alias: string; model_id: string }>();
	const map = new Map<string, string>();
	for (const row of result.results ?? []) {
		map.set(row.alias, row.model_id);
	}
	return map;
}

/**
 * Returns the set of model_ids that are alias-only (original name hidden).
 */
export async function loadAliasOnlySet(
	db: D1Database,
): Promise<Set<string>> {
	const result = await db
		.prepare("SELECT DISTINCT model_id FROM model_aliases WHERE alias_only = 1")
		.all<{ model_id: string }>();
	return new Set((result.results ?? []).map((r) => r.model_id));
}

/**
 * Returns all aliases grouped by model_id.
 */
export async function listAllAliases(
	db: D1Database,
): Promise<Map<string, Array<{ alias: string; is_primary: boolean; alias_only: boolean }>>> {
	const result = await db
		.prepare(
			"SELECT model_id, alias, is_primary, alias_only FROM model_aliases ORDER BY model_id, is_primary DESC, alias",
		)
		.all<AliasRow>();
	const map = new Map<string, Array<{ alias: string; is_primary: boolean; alias_only: boolean }>>();
	for (const row of result.results ?? []) {
		const existing = map.get(row.model_id) ?? [];
		existing.push({ alias: row.alias, is_primary: row.is_primary === 1, alias_only: row.alias_only === 1 });
		map.set(row.model_id, existing);
	}
	return map;
}

/**
 * Returns all aliases for a specific model.
 */
export async function getAliasesForModel(
	db: D1Database,
	modelId: string,
): Promise<Array<{ alias: string; is_primary: boolean; alias_only: boolean }>> {
	const result = await db
		.prepare(
			"SELECT alias, is_primary, alias_only FROM model_aliases WHERE model_id = ? ORDER BY is_primary DESC, alias",
		)
		.bind(modelId)
		.all<{ alias: string; is_primary: number; alias_only: number }>();
	return (result.results ?? []).map((row) => ({
		alias: row.alias,
		is_primary: row.is_primary === 1,
		alias_only: row.alias_only === 1,
	}));
}

/**
 * Replaces all aliases for a model with the given list.
 * Uses batch delete + insert for atomicity.
 */
export async function saveAliasesForModel(
	db: D1Database,
	modelId: string,
	aliases: AliasInput[],
	aliasOnly = false,
): Promise<void> {
	const now = nowIso();
	const deleteStmt = db
		.prepare("DELETE FROM model_aliases WHERE model_id = ?")
		.bind(modelId);

	const insertStmts = aliases.map((a) =>
		db
			.prepare(
				"INSERT INTO model_aliases (id, model_id, alias, is_primary, alias_only, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
			)
			.bind(
				crypto.randomUUID(),
				modelId,
				a.alias,
				a.is_primary ? 1 : 0,
				aliasOnly ? 1 : 0,
				now,
				now,
			),
	);

	await db.batch([deleteStmt, ...insertStmts]);
}

/**
 * Deletes all aliases for a model.
 */
export async function deleteAliasesForModel(
	db: D1Database,
	modelId: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM model_aliases WHERE model_id = ?")
		.bind(modelId)
		.run();
}

// ---------------------------------------------------------------------------
// Per-channel alias functions (channel_model_aliases table)
// ---------------------------------------------------------------------------

/**
 * Replaces all per-channel aliases for a specific channel + model pair.
 * Uses batch delete + insert for atomicity.
 */
export async function saveChannelAliases(
	db: D1Database,
	channelId: string,
	modelId: string,
	aliases: AliasInput[],
	aliasOnly = false,
): Promise<void> {
	const now = nowIso();
	const deleteStmt = db
		.prepare("DELETE FROM channel_model_aliases WHERE channel_id = ? AND model_id = ?")
		.bind(channelId, modelId);

	const insertStmts = aliases.map((a) =>
		db
			.prepare(
				"INSERT INTO channel_model_aliases (id, channel_id, model_id, alias, is_primary, alias_only, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			)
			.bind(
				crypto.randomUUID(),
				channelId,
				modelId,
				a.alias,
				a.is_primary ? 1 : 0,
				aliasOnly ? 1 : 0,
				now,
				now,
			),
	);

	await db.batch([deleteStmt, ...insertStmts]);
}

/**
 * Returns per-channel alias hits for a given alias name.
 * Used by the proxy to find channels that have a per-channel alias for a model.
 */
export async function loadChannelAliasesByAlias(
	db: D1Database,
	alias: string,
): Promise<Array<{ channel_id: string; model_id: string; alias_only: boolean }>> {
	const result = await db
		.prepare("SELECT channel_id, model_id, alias_only FROM channel_model_aliases WHERE alias = ?")
		.bind(alias)
		.all<{ channel_id: string; model_id: string; alias_only: number }>();
	return (result.results ?? []).map((r) => ({
		channel_id: r.channel_id,
		model_id: r.model_id,
		alias_only: r.alias_only === 1,
	}));
}

/**
 * Returns a map of alias → model_id across all channels.
 * Used by the /v1/models endpoint to list per-channel aliases.
 */
export async function loadAllChannelAliasMap(
	db: D1Database,
): Promise<Map<string, string>> {
	const result = await db
		.prepare("SELECT alias, model_id FROM channel_model_aliases")
		.all<{ alias: string; model_id: string }>();
	const map = new Map<string, string>();
	for (const row of result.results ?? []) {
		// First one wins (multiple channels may alias the same name)
		if (!map.has(row.alias)) {
			map.set(row.alias, row.model_id);
		}
	}
	return map;
}

/**
 * Returns a map of channelId → Set<modelId> for models with alias_only=1.
 * Used by the proxy to check per-channel alias_only status.
 */
export async function loadChannelAliasOnlyMap(
	db: D1Database,
): Promise<Map<string, Set<string>>> {
	const result = await db
		.prepare("SELECT DISTINCT channel_id, model_id FROM channel_model_aliases WHERE alias_only = 1")
		.all<{ channel_id: string; model_id: string }>();
	const map = new Map<string, Set<string>>();
	for (const row of result.results ?? []) {
		const existing = map.get(row.channel_id) ?? new Set<string>();
		existing.add(row.model_id);
		map.set(row.channel_id, existing);
	}
	return map;
}
