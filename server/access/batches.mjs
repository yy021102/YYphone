const encoder = new TextEncoder();
async function key(secret) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode('yyphone-code-export-v1:' + secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function sealCodes(codes, secret, batchId) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(batchId) }, await key(secret), encoder.encode(JSON.stringify(codes)));
  return JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(ciphertext)) });
}
export async function openCodes(sealed, secret, batchId) {
  const { iv, data } = JSON.parse(sealed);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv), additionalData: encoder.encode(batchId) }, await key(secret), new Uint8Array(data));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
