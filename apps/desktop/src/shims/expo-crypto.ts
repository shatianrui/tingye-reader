export const CryptoDigestAlgorithm = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA384: 'SHA-384', SHA512: 'SHA-512' } as const;
export const CryptoEncoding = { HEX: 'hex', BASE64: 'base64' } as const;

export async function digestStringAsync(algorithm: string, data: string, options: { encoding?: string } = {}) {
  const digest = new Uint8Array(await crypto.subtle.digest(algorithm, new TextEncoder().encode(data)));
  if (options.encoding === CryptoEncoding.BASE64) return btoa(String.fromCharCode(...digest));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}
export const randomUUID = () => crypto.randomUUID();
export function getRandomBytes(length: number) { return crypto.getRandomValues(new Uint8Array(length)); }
