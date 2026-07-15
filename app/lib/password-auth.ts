const PBKDF2_ITERATIONS = 600_000;
const encoder = new TextEncoder();

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(18));
  const digest = await derivePassword(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${base64Url(salt)}$${base64Url(digest)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [algorithm, iterationsText, saltText, digestText] = encoded.split("$");
    if (algorithm !== "pbkdf2_sha256") return false;
    const iterations = Number(iterationsText);
    if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
    const salt = fromBase64Url(saltText);
    const expected = fromBase64Url(digestText);
    const actual = await derivePassword(password, salt, iterations);
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createSessionToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sessionTokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return base64Url(new Uint8Array(digest));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations,
  }, key, 256);
  return new Uint8Array(bits);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}
