import { z } from "zod";
import type { Config } from "./config";
import {
	defaultFetch,
	type Fetcher,
	PluginError,
	parse,
	record,
	requestJson,
	token,
} from "./http";

export async function graphql(
	config: Config,
	credentials: unknown,
	query: string,
	variables: Record<string, unknown>,
	fetcher: Fetcher = defaultFetch,
) {
	const bundle = parse(
		z.object({ shopify: z.object({ secret_accessToken: token }) }),
		credentials,
		"MISSING_CREDENTIALS",
	);
	const result = await requestJson(
		`https://${config.shop}/admin/api/2026-10/graphql.json`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Shopify-Access-Token": bundle.shopify.secret_accessToken,
			},
			body: JSON.stringify({ query, variables }),
		},
		config.timeoutMs,
		fetcher,
	);
	if (result.errors) throw new PluginError("GRAPHQL_ERROR");
	return record(result.data);
}
