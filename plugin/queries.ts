export const orderFields = `id name createdAt updatedAt cancelledAt closedAt displayFinancialStatus displayFulfillmentStatus returnStatus totalPriceSet { shopMoney { amount currencyCode } }`;
export const pageInfo = `pageInfo { hasNextPage endCursor }`;
export const queries = {
	connection: `query { shop { id name myshopifyDomain } }`,
	orders: `query($first:Int!,$after:String,$query:String) { orders(first:$first,after:$after,query:$query,sortKey:CREATED_AT) { nodes { ${orderFields} } ${pageInfo} } }`,
	order: `query($id:ID!) { order(id:$id) { ${orderFields} } }`,
	lineItems: `query($id:ID!,$first:Int!,$after:String) { order(id:$id) { id name lineItems(first:$first,after:$after) { nodes { id name sku quantity currentQuantity refundableQuantity } ${pageInfo} } } }`,
	fulfillments: `query($id:ID!,$first:Int!) { order(id:$id) { id name fulfillmentsCount { count precision } fulfillments(first:$first) { id status displayStatus createdAt updatedAt estimatedDeliveryAt deliveredAt trackingInfo(first:20) { company number url } } } }`,
};
