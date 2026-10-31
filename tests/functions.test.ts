import { describe, expect, test } from "bun:test";
import { configSchema } from "../plugin/config";
import { createFunctions } from "../plugin/functions";
import type { Fetcher } from "../plugin/http";
import { queries } from "../plugin/queries";
import type { Store } from "../plugin/tools";

const credentials = { shopify: { secret_accessToken: "test-token" } };
const store = {
	get: async () => ({ value: { shop: "sample.myshopify.com" } }),
} as unknown as Store;
function handler(name: string, fetcher: Fetcher, source = store) {
	const fn = createFunctions(source, fetcher).find(
		(entry) => entry.name === name,
	);
	if (!fn) throw new Error("missing tool");
	return fn.handler;
}
describe("Shopify read evidence", () => {
	test("strict host boundary excludes custom hosts, ports, userinfo, paths and secrets", () => {
		for (const shop of [
			"https://sample.myshopify.com",
			"sample.myshopify.com.evil.test",
			"sample.myshopify.com:443",
			"a@sample.myshopify.com",
			"sample.myshopify.com/",
			"SAMPLE.myshopify.com",
		])
			expect(configSchema.safeParse({ shop }).success).toBe(false);
		expect(
			configSchema.safeParse({
				shop: "sample.myshopify.com",
				accessToken: "bad",
			}).success,
		).toBe(false);
	});
	test("named credential-backed tools contain only fixed read queries", () => {
		for (const fn of createFunctions(store)) {
			expect(fn.calling).toBe("named");
			expect(fn.requiredCredentials).toEqual(["shopify"]);
			expect(fn.metadata?.readonly).toBe(true);
		}
		for (const query of Object.values(queries)) {
			expect(query.startsWith("query")).toBe(true);
			expect(query).not.toContain("mutation");
		}
	});
	test("pins API and forwards a search as a variable with explicit pagination", async () => {
		const result = await handler("listOrders", async (url, init) => {
			expect(url).toBe(
				"https://sample.myshopify.com/admin/api/2026-10/graphql.json",
			);
			expect(new Headers(init.headers).get("X-Shopify-Access-Token")).toBe(
				"test-token",
			);
			const body = JSON.parse(String(init.body));
			expect(body.variables).toEqual({
				first: 7,
				after: "cursor",
				query: "status:open",
			});
			return Response.json({
				data: {
					orders: {
						nodes: [],
						pageInfo: { hasNextPage: false, endCursor: null },
					},
				},
			});
		})(credentials, { pageSize: 7, after: "cursor", query: "status:open" });
		expect(result.nodes).toEqual([]);
	});
	test("rejects bad input and credentials before network", async () => {
		const noFetch: Fetcher = async () => {
			throw new Error("unexpected network");
		};
		await expect(
			handler("getOrder", noFetch)(credentials, {
				id: "gid://shopify/Customer/1",
			}),
		).rejects.toThrow("INVALID_INPUT");
		await expect(
			handler("listOrders", noFetch)(credentials, { pageSize: 101 }),
		).rejects.toThrow("INVALID_INPUT");
		await expect(handler("testConnection", noFetch)({}, {})).rejects.toThrow(
			"MISSING_CREDENTIALS",
		);
	});
	test("detects shop mismatch, null order and GraphQL errors without body leakage", async () => {
		await expect(
			handler("testConnection", async () =>
				Response.json({
					data: { shop: { myshopifyDomain: "wrong.myshopify.com" } },
				}),
			)(credentials, {}),
		).rejects.toThrow("ACCOUNT_MISMATCH");
		await expect(
			handler("getOrder", async () => Response.json({ data: { order: null } }))(
				credentials,
				{ id: "gid://shopify/Order/1" },
			),
		).rejects.toThrow("NOT_FOUND");
		await expect(
			handler("listOrders", async () =>
				Response.json({ errors: [{ message: "PRIVATE TOKEN" }] }),
			)(credentials, {}),
		).rejects.toThrow("GRAPHQL_ERROR");
	});
});

test("exact orders reject mismatched records and pages respect configured limits", async () => {
	await expect(
		handler("getOrder", async () =>
			Response.json({ data: { order: { id: "gid://shopify/Order/2" } } }),
		)(credentials, { id: "gid://shopify/Order/1" }),
	).rejects.toThrow("REFERENCE_MISMATCH");
	await expect(
		handler("listOrders", async () =>
			Response.json({ data: { orders: { nodes: [{}, {}] } } }),
		)(credentials, { pageSize: 1 }),
	).rejects.toThrow("INVALID_RESPONSE");
});
test("line item pagination retains exact order boundary and cursor", async () => {
	const result = await handler("listOrderLineItems", async (_url, init) => {
		const { variables } = JSON.parse(String(init.body));
		expect(variables.first).toBe(2);
		expect(variables.after).toBe("next");
		return Response.json({
			data: {
				order: {
					id: variables.id,
					lineItems: {
						nodes: [{ sku: "SKU", refundableQuantity: 1 }],
						pageInfo: { endCursor: "last", hasNextPage: true },
					},
				},
			},
		});
	})(credentials, { id: "gid://shopify/Order/1", pageSize: 2, after: "next" });
	expect(result.lineItems.pageInfo.endCursor).toBe("last");
});
