import { z } from "zod";
import { timeout } from "./http";
export const configSchema = z.strictObject({
	shop: z
		.string()
		.regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/),
	timeoutMs: timeout,
});
export type Config = z.infer<typeof configSchema>;
