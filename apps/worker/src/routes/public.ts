import { Hono } from "hono";
import type { AppEnv } from "../env";
import { extractModelPricings, extractSharedModelPricings } from "../services/channel-models";
import { listActiveChannels } from "../services/channel-repo";
import { loadPrimaryNameMap, loadAliasOnlySet, loadAliasMap, loadAllChannelAliasMap, loadChannelAliasOnlyMap, loadChannelPrimaryNameMap } from "../services/model-aliases";
import { getRegistrationMode, getSiteMode } from "../services/settings";

const publicRoutes = new Hono<AppEnv>();

/**
 * Lightweight site info endpoint — always accessible.
 */
publicRoutes.get("/site-info", async (c) => {
	const siteMode = await getSiteMode(c.env.DB);
	const registrationMode = await getRegistrationMode(c.env.DB);
	const linuxdoEnabled = Boolean(c.env.LINUXDO_CLIENT_ID);
	return c.json({ site_mode: siteMode, registration_mode: registrationMode, linuxdo_enabled: linuxdoEnabled });
});

/**
 * Public models endpoint — controlled by site mode.
 *
 * personal → 403, not public
 * service  → show models with prices (users pay per usage)
 * shared   → show shared-flagged models only, hide prices and channel names
 */
publicRoutes.get("/models", async (c) => {
	const siteMode = await getSiteMode(c.env.DB);

	if (siteMode === "personal") {
		return c.json({ error: "模型信息不公开" }, 403);
	}

	const channels = await listActiveChannels(c.env.DB);
	const modelMap = new Map<
		string,
		Array<{
			id: string;
			name: string;
			input_price: number | null;
			output_price: number | null;
		}>
	>();
	const modelChannelIds = new Map<string, string[]>();

	for (const channel of channels) {
		const pricings = siteMode === "shared"
			? extractSharedModelPricings(channel)
			: extractModelPricings(channel);
		for (const p of pricings) {
			const existing = modelMap.get(p.id) ?? [];
			if (siteMode === "shared") {
				existing.push({
					id: channel.id,
					name: "共享渠道",
					input_price: null,
					output_price: null,
				});
			} else {
				existing.push({
					id: channel.id,
					name: channel.name,
					input_price: p.input_price ?? null,
					output_price: p.output_price ?? null,
				});
			}
			modelMap.set(p.id, existing);

			const chIds = modelChannelIds.get(p.id) ?? [];
			chIds.push(channel.id);
			modelChannelIds.set(p.id, chIds);
		}
	}

	// Load alias data from both global and per-channel tables
	const primaryNames = await loadPrimaryNameMap(c.env.DB);
	const channelPrimaryNames = await loadChannelPrimaryNameMap(c.env.DB);
	const globalAliasOnlySet = await loadAliasOnlySet(c.env.DB);
	const channelAliasOnlyMap = await loadChannelAliasOnlyMap(c.env.DB);
	const globalAliasMap = await loadAliasMap(c.env.DB);
	const channelAliasMap = await loadAllChannelAliasMap(c.env.DB);

	const modelIdSet = new Set(modelMap.keys());
	const models: Array<{ id: string; display_name: string; channels: typeof modelMap extends Map<string, infer V> ? V : never }> = [];

	// Add original model entries, hiding alias-only models
	for (const [id, chs] of modelMap) {
		if (globalAliasOnlySet.has(id)) continue;

		const providers = modelChannelIds.get(id) ?? [];
		if (providers.length > 0) {
			const allAliasOnly = providers.every((chId) => {
				const aoModels = channelAliasOnlyMap.get(chId);
				return aoModels?.has(id) ?? false;
			});
			if (allAliasOnly) continue;
		}

		const displayName = primaryNames.get(id) ?? channelPrimaryNames.get(id) ?? id;
		models.push({ id, display_name: displayName, channels: chs });
	}

	// Add global alias entries
	const listedIds = new Set(models.map((m) => m.id));
	for (const [alias, targetModelId] of globalAliasMap) {
		if (modelIdSet.has(targetModelId) && !listedIds.has(alias)) {
			models.push({
				id: alias,
				display_name: alias,
				channels: modelMap.get(targetModelId) ?? [],
			});
			listedIds.add(alias);
		}
	}

	// Add per-channel alias entries
	for (const [alias, targetModelId] of channelAliasMap) {
		if (modelIdSet.has(targetModelId) && !listedIds.has(alias)) {
			models.push({
				id: alias,
				display_name: alias,
				channels: modelMap.get(targetModelId) ?? [],
			});
			listedIds.add(alias);
		}
	}

	return c.json({ models, site_mode: siteMode });
});

export default publicRoutes;
