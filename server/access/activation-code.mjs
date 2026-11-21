const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function activationCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(15)), value => alphabet[value & 31]).join('');
}
export function normalizeActivationCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim();
  if (/^[A-HJ-NP-Z2-9]{15}$/i.test(code)) return code.toUpperCase();
  if (/^[a-f0-9]{64}$/i.test(code)) return code.toLowerCase();
  return null;
}
