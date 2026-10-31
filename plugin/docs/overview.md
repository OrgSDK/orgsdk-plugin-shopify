# OrgSDK Shopify evidence plugin

Read-only Shopify Admin GraphQL API **2026-10**, pinned in source. Builds order,
fulfillment and return-status evidence for late-order and return reviews. No
mutations, refunds, order edits, customer notifications or arbitrary GraphQL.

## Setup

1. Create and install your own appropriate Shopify app with `read_orders` access.
   Approve protected customer data access as required for that app's distribution.
2. Obtain an Admin API access token using Shopify's supported authentication flow.
   This plugin does not register an app, exchange client credentials or run OAuth.
   Client ID/client secret and Storefront API tokens are not Admin access tokens.
3. Configure `{ "shop": "your-store.myshopify.com" }` in the plugin. Only a single
   lowercase DNS label plus `.myshopify.com` is accepted; no scheme, custom domain,
   path, port or alternate host. Optional `timeoutMs` controls the bounded timeout.
4. Attach provider `shopify` with secret key `secret_accessToken` through OrgSDK.
   Keep token issuance/renewal outside this plugin and replace expired credentials
   through OrgSDK's normal credential settings. Never put secrets in configuration.
5. Call `testConnection({})`; it verifies the returned canonical shop domain.

Shopify's client-credentials grant is for an installed app on stores owned by your
organization and currently issues tokens with an expiry (24 hours). Other merchant
installs require the applicable app authentication/authorization flow and may use
other expiring token types. Token lifetime comes from the grant response, not this
plugin. Do not assume a permanent admin-created custom-app token is available.

`read_orders` covers these Order/Fulfillment reads. Only the most recent 60 days
are normally visible. Older records need approved `read_all_orders` access in
addition to the required order read scope. No write scope is needed here.
Order information is protected customer data even when names, phone, email and
addresses are excluded, as here. Public app review/entitlements may still be
required; redacted fields or access errors are not proof that no orders exist.
A successful shop check does not prove order-data or protected-data entitlement.

## Named functions

| Function               | Arguments                     | Result                                                        |
| ---------------------- | ----------------------------- | ------------------------------------------------------------- |
| `testConnection`       | `{}`                          | shop ID, name, canonical domain                               |
| `listOrders`           | `{pageSize?, after?, query?}` | nodes and `pageInfo`                                          |
| `getOrder`             | `{id}`                        | exact order summary                                           |
| `listOrderLineItems`   | `{id, pageSize?, after?}`     | order ID/name and paginated SKU/quantity evidence             |
| `getOrderFulfillments` | `{id, pageSize?}`             | order ID/name, fulfillment count and bounded tracking samples |

`id` is an exact `gid://shopify/Order/<digits>` obtained from this store. The
fixed configured store and its token determine account access; GIDs alone do not
encode store ownership. `pageSize` is 1–100 (default 25), `after` is a bounded
opaque cursor. `query` is at most 512 characters of Shopify **order search** syntax
(e.g. `status:open fulfillment_status:unfulfilled`), supplied only as a GraphQL
variable. There is no query-document override. Order pages sort by creation time.

Order summaries include ID/name, dates, financial/fulfillment/return statuses and
shop-currency total. Line items include ID/name, SKU, quantity, current quantity
and refundable quantity. These quantities are evidence, not refund approval.
Continue order and line-item pages using `pageInfo.endCursor` while
`hasNextPage`. Fulfillments are an API array with a `first` cap; its count and
precision expose possible truncation. Tracking is at most 20 references per
fulfillment and must always be treated as a sample. There is no fulfillment or
tracking cursor in this API field. API/schema or scope changes fail closed as
`GRAPHQL_ERROR`, without returning partial data or upstream error text.

## Official references

- [GraphQL API authentication and endpoint](https://shopify.dev/docs/api/admin-graphql/2026-10)
- [Orders and search](https://shopify.dev/docs/api/admin-graphql/2026-10/queries/orders)
- [Order fields, scope and 60-day boundary](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/Order)
- [Fulfillment fields and tracking caps](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/Fulfillment)
- [Client credentials grant and token expiry](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant)
- [Protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)

Private read-only integration. See the repository README for verification and artifact instructions.
