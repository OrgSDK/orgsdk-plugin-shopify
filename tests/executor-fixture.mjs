import assert from "node:assert/strict";

const order = {
	id: "gid://shopify/Order/81",
	name: "#81",
	lineItems: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
	fulfillments: [],
};
export default async function createFixture() {
	return {
		configuration: { shop: "sample.myshopify.com" },
		provider: "shopify",
		secret: { secret_accessToken: "synthetic-shopify" },
		async fetch(request) {
			const url = new URL(request.url);
			assert.equal(url.origin, "https://sample.myshopify.com");
			assert.equal(request.method, "POST");
			assert.equal(
				request.headers.get("x-shopify-access-token"),
				"synthetic-shopify",
			);
			const body = await request.json();
			assert(body.query.startsWith("query"));
			return Response.json({
				data: {
					shop: {
						id: "gid://shopify/Shop/1",
						myshopifyDomain: "sample.myshopify.com",
					},
					orders: {
						nodes: [{ id: order.id, name: order.name }],
						pageInfo: { hasNextPage: false, endCursor: null },
					},
					order: {
						id: order.id,
						name: order.name,
						...(body.query.includes("lineItems(")
							? { lineItems: order.lineItems }
							: {}),
						...(body.query.includes("fulfillments(")
							? { fulfillments: order.fulfillments }
							: {}),
					},
				},
			});
		},
		async run(call) {
			assert.equal(
				(await call("testConnection")).myshopifyDomain,
				"sample.myshopify.com",
			);
			assert.equal((await call("listOrders")).nodes[0].id, order.id);
			assert.equal((await call("getOrder", { id: order.id })).id, order.id);
			assert.equal(
				(await call("listOrderLineItems", { id: order.id })).lineItems.nodes
					.length,
				0,
			);
			assert.equal(
				(await call("getOrderFulfillments", { id: order.id })).fulfillments
					.length,
				0,
			);
		},
	};
}
