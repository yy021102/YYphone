/** Accept either a raw token or a copied Authorization value, without sending Bearer twice. */
export const bearerApiKey = (value: string): string => value.trim().replace(/^Bearer(?:\s+|$)/i, '').trim();
