import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_KEY_PREFIX,
  authenticateBearerApiKey,
  createApiKeyMaterial,
  decryptApiKeySecret,
  encryptApiKeySecret,
  generateApiKey,
  parseApiKey,
  parseBearerApiKey,
  revealApiKey,
  verifyApiKeySecret,
} from "./api-key";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("API key cryptography", () => {
  it("generates a high-entropy key whose secret is hashed and encrypted rather than persisted in plaintext", () => {
    const key = generateApiKey("test-auth-secret");

    expect(key.apiKey).toMatch(new RegExp(`^${API_KEY_PREFIX}[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}$`));
    expect(key.secretHash).not.toContain(key.secret);
    expect(key.encryptedSecret).not.toContain(key.secret);
    expect(verifyApiKeySecret(key.secret, key.secretHash)).toBe(true);
    expect(verifyApiKeySecret(`${key.secret}x`, key.secretHash)).toBe(false);
    expect(decryptApiKeySecret(key.encryptedSecret, "test-auth-secret")).toBe(key.secret);
  });

  it("parses only well-formed Bearer keys", () => {
    const key = createApiKeyMaterial("test-auth-secret");
    expect(parseApiKey(key.apiKey)).toEqual({ keyId: key.keyId, secret: key.secret });
    expect(parseBearerApiKey(`Bearer ${key.apiKey}`)).toEqual({ keyId: key.keyId, secret: key.secret });
    expect(parseBearerApiKey(`Basic ${key.apiKey}`)).toBeNull();
    expect(parseBearerApiKey(`Bearer ${key.apiKey} extra`)).toBeNull();
    expect(parseApiKey(`${API_KEY_PREFIX}not-a-key`)).toBeNull();
  });

  it("authenticates only a matching, non-revoked persisted key and keeps failed cases generic", () => {
    const key = createApiKeyMaterial("test-auth-secret");
    const active = { id: key.keyId, secretHash: key.secretHash, revokedAt: null, userId: "user-a" };
    const revoked = { ...active, revokedAt: "2026-08-28T00:00:00.000Z" };

    expect(authenticateBearerApiKey(`Bearer ${key.apiKey}`, (id) => id === active.id ? active : undefined)).toEqual(active);
    expect(authenticateBearerApiKey(`Bearer ${key.apiKey}`, () => revoked)).toBeNull();
    expect(authenticateBearerApiKey(`Bearer ${key.apiKey}`, () => undefined)).toBeNull();
    expect(authenticateBearerApiKey(`Bearer ${key.apiKey}x`, () => active)).toBeNull();
  });

  it("only reconstructs a valid key with the configured AUTH_SECRET", () => {
    const key = createApiKeyMaterial("test-auth-secret");
    expect(revealApiKey({ id: key.keyId, encryptedSecret: key.encryptedSecret }, "test-auth-secret")).toBe(key.apiKey);
    expect(revealApiKey({ id: key.keyId, encryptedSecret: key.encryptedSecret }, "wrong-auth-secret")).toBeNull();
    expect(encryptApiKeySecret(key.secret, "test-auth-secret")).not.toBe(key.encryptedSecret);
  });

  it("requires AUTH_SECRET for encryption in production", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => createApiKeyMaterial()).toThrow(/AUTH_SECRET/);
  });
});
