import { z } from "zod";
import { graphql } from "./client";
import {
	cursor,
	defaultFetch,
	type Fetcher,
	PluginError,
	pageSize,
	parse,
	record,
} from "./http";
import { queries } from "./queries";
import { empty, idParameter, pageParameters, type Store, tools } from "./tools";

const id = z.string().regex(/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,24}$/);
const page = z.strictObject({ pageSize, after: cursor });
export function createFunctions(store: Store, fetcher: Fetcher = defaultFetch) {
	const tool = tools(store);
	const run =
		(query: string) =>
		(
			config: Parameters<typeof graphql>[0],
			credentials: unknown,
			variables: Record<string, unknown>,
		) =>
			graphql(config, credentials, query, variables, fetcher);
	const order = async (
		config: Parameters<typeof graphql>[0],
		credentials: unknown,
		input: { id: string } & Record<string, unknown>,
		query: string,
	) => {
		const result = await run(query)(config, credentials, input);
		if (!result.order) throw new PluginError("NOT_FOUND");
		const row = record(result.order);
		if (row.id !== input.id) throw new PluginError("REFERENCE_MISMATCH");
		if (row.lineItems)
			parse(
				z.array(z.unknown()).max(Number(input.first)),
				record(row.lineItems).nodes,
				"INVALID_RESPONSE",
			);
		if (row.fulfillments) {
			const fulfillments = parse(
				z.array(z.unknown()).max(Number(input.first)),
				row.fulfillments,
				"INVALID_RESPONSE",
			);
			for (const fulfillment of fulfillments)
				parse(
					z.array(z.unknown()).max(20),
					record(fulfillment).trackingInfo,
					"INVALID_RESPONSE",
				);
		}
		return row;
	};
	return [
		tool(
			"testConnection",
			"Read shop identity and verify it matches the configured myshopify.com store.",
			empty,
			[],
			async (config, credentials) => {
				const data = await run(queries.connection)(config, credentials, {});
				const shop = record(data.shop);
				if (shop.myshopifyDomain !== config.shop)
					throw new PluginError("ACCOUNT_MISMATCH");
				return shop;
			},
		),
		tool(
			"listOrders",
			"Read one cursor page of order evidence. Search uses Shopify order search syntax, never GraphQL.",
			page.extend({ query: z.string().max(512).optional() }),
			[...pageParameters, { name: "query", type: "string", optional: true }],
			async (config, credentials, input) => {
				const data = await run(queries.orders)(config, credentials, {
					first: input.pageSize,
					after: input.after,
					query: input.query,
				});
				const orders = record(data.orders);
				parse(
					z.array(z.unknown()).max(input.pageSize),
					orders.nodes,
					"INVALID_RESPONSE",
				);
				return orders;
			},
		),
		tool(
			"getOrder",
			"Read one exact order, including return and fulfillment status.",
			z.strictObject({ id }),
			[idParameter],
			(config, credentials, input) =>
				order(config, credentials, input, queries.order),
		),
		tool(
			"listOrderLineItems",
			"Read one cursor page of purchased SKU and quantity evidence for a return review.",
			page.extend({ id }),
			[idParameter, ...pageParameters],
			(config, credentials, input) =>
				order(
					config,
					credentials,
					{ ...input, first: input.pageSize },
					queries.lineItems,
				),
		),
		tool(
			"getOrderFulfillments",
			"Read up to 100 fulfillments with up to 20 tracking references each. Count exposes fulfillment truncation; tracking is always a bounded sample.",
			z.strictObject({ id, pageSize }),
			[idParameter, { name: "pageSize", type: "number", optional: true }],
			(config, credentials, input) =>
				order(
					config,
					credentials,
					{ ...input, first: input.pageSize },
					queries.fulfillments,
				),
		),
	];
}
