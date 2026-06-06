import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const TEST_KEY = 'a'.repeat(64);

function withKey(fn) {
  const prev = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  try {
    return fn();
  } finally {
    if (prev === undefined) {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.TOKEN_ENCRYPTION_KEY = prev;
    }
  }
}

const { encryptToken, decryptToken, isEncryptedToken } = await import('./token-crypto.js');

test('encryptToken produces enc:v1: prefix', () => {
  withKey(() => {
    const encrypted = encryptToken('my-secret-token');
    assert.ok(encrypted.startsWith('enc:v1:'), `Expected enc:v1: prefix, got: ${encrypted}`);
  });
});

test('decryptToken round-trips correctly', () => {
  withKey(() => {
    const plain = 'AQIDBAUGBwgJCgsM';
    const encrypted = encryptToken(plain);
    const decrypted = decryptToken(encrypted);
    assert.equal(decrypted, plain);
  });
});

test('encryptToken is non-deterministic (unique IV per call)', () => {
  withKey(() => {
    const a = encryptToken('same-token');
    const b = encryptToken('same-token');
    assert.notEqual(a, b);
  });
});

test('encryptToken is idempotent on already-encrypted tokens', () => {
  withKey(() => {
    const encrypted = encryptToken('plain-token');
    const reEncrypted = encryptToken(encrypted);
    assert.equal(reEncrypted, encrypted);
  });
});

test('decryptToken returns plaintext tokens unchanged', () => {
  withKey(() => {
    const plain = 'not-encrypted-token';
    assert.equal(decryptToken(plain), plain);
  });
});

test('isEncryptedToken identifies encrypted tokens', () => {
  withKey(() => {
    const encrypted = encryptToken('token');
    assert.ok(isEncryptedToken(encrypted));
    assert.ok(!isEncryptedToken('plain'));
    assert.ok(!isEncryptedToken(''));
  });
});

test('decryptToken throws on tampered ciphertext', () => {
  withKey(() => {
    const encrypted = encryptToken('my-token');
    const tampered = encrypted.slice(0, -4) + 'XXXX';
    assert.throws(() => decryptToken(tampered));
  });
});

test('encryptToken throws on empty string', () => {
  withKey(() => {
    assert.throws(() => encryptToken(''), /non-empty/);
  });
});

test('TOKEN_ENCRYPTION_KEY with wrong length throws', () => {
  const prev = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = 'short';
  try {
    assert.throws(() => encryptToken('token'), /64 hex/);
  } finally {
    if (prev === undefined) {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.TOKEN_ENCRYPTION_KEY = prev;
    }
  }
});

test('encryptToken without key returns plaintext (pass-through mode)', () => {
  const prev = process.env.TOKEN_ENCRYPTION_KEY;
  delete process.env.TOKEN_ENCRYPTION_KEY;
  try {
    const result = encryptToken('my-plain-token');
    assert.equal(result, 'my-plain-token');
  } finally {
    if (prev !== undefined) {
      process.env.TOKEN_ENCRYPTION_KEY = prev;
    }
  }
});
