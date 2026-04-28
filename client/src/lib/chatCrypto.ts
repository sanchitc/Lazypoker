// End-to-end-ish chat encryption.
//
// All players in a room already share the room code as a secret (you can't
// join without it). We derive an AES-GCM key from `roomCode` via PBKDF2 and
// use it to seal every message before it leaves the client. The server only
// ever sees `{ iv, ciphertext }` — both base64 — and cannot read messages
// without knowing the room code.
//
// This is symmetric, not asymmetric: a member of the room can decrypt every
// other member's messages (which is what we want for a group chat). The
// server, an attacker who scrapes broadcast traffic, or anyone without the
// room code cannot.

const PBKDF2_ITERATIONS = 100_000;
const SALT = new TextEncoder().encode('lazypoker:chat:v1');

const keyCache = new Map<string, Promise<CryptoKey>>();

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const buf = new ArrayBuffer(s.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(roomCode: string): Promise<CryptoKey> {
  const cached = keyCache.get(roomCode);
  if (cached) return cached;

  const promise = (async () => {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(roomCode),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: SALT, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  })();

  keyCache.set(roomCode, promise);
  return promise;
}

export async function encryptChat(
  roomCode: string,
  plaintext: string
): Promise<{ iv: string; ciphertext: string }> {
  const key = await deriveKey(roomCode);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(buf)),
  };
}

export async function decryptChat(
  roomCode: string,
  iv: string,
  ciphertext: string
): Promise<string> {
  const key = await deriveKey(roomCode);
  const buf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext)
  );
  return new TextDecoder().decode(buf);
}
