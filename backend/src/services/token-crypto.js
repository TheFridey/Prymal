/**
 * AES-256-GCM symmetric encryption for OAuth access/refresh tokens.
 *
 * Tokens are stored as:   enc:v1:<base64(iv+authTag+ciphertext)>
 * Plain (legacy) tokens:  anything not starting with "enc:v1:"
 *
 * Environment variable: TOKEN_ENCRYPTION_KEY  (64 hex chars = 32 bytes)
 * If the key is absent the module operates in pass-through mode (no encryption),
 * emitting a single warning on first use so existing deployments are not broken.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = 'enc:v1:';

let _warned = false;

function getKey() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    if (!_warned) {
      _warned = true;
      // eslint-disable-next-line no-console
      console.warn('[token-crypto] TOKEN_ENCRYPTION_KEY is not set – tokens stored as plaintext. Set a 64-hex-char key in production.');
    }
    return null;
  }
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext token.
 * Returns the token unchanged if TOKEN_ENCRYPTION_KEY is not set.
 * @param {string} plaintext
 * @returns {string}
 */
export function encryptToken(plaintext) {
  if (typeof plaintext !== 'string' || !plaintext) {
    throw new TypeError('encryptToken: plaintext must be a non-empty string.');
  }
  if (plaintext.startsWith(PREFIX)) {
    return plaintext;
  }
  const key = getKey();
  if (!key) {
    return plaintext;
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, tag, encrypted]);
  return `${PREFIX}${combined.toString('base64')}`;
}

/**
 * Decrypt a token produced by encryptToken.
 * Returns the token unchanged if it is not in encrypted format.
 * @param {string} token
 * @returns {string}
 */
export function decryptToken(token) {
  if (typeof token !== 'string' || !token) {
    throw new TypeError('decryptToken: token must be a non-empty string.');
  }
  if (!token.startsWith(PREFIX)) {
    return token;
  }
  const key = getKey();
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY is required to decrypt tokens.');
  }

  const combined = Buffer.from(token.slice(PREFIX.length), 'base64');
  if (combined.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('Encrypted token payload is too short – possible corruption.');
  }

  const iv = combined.subarray(0, IV_BYTES);
  const tag = combined.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = combined.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final('utf8');
}

/**
 * Returns true if the token is stored in encrypted form.
 * @param {string} token
 * @returns {boolean}
 */
export function isEncryptedToken(token) {
  return typeof token === 'string' && token.startsWith(PREFIX);
}
