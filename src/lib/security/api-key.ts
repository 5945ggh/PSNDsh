import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * API keys deliberately contain a non-secret locator so authentication can
 * fetch exactly one row before comparing its secret hash. The locator is not
 * a user identifier and must not be treated as an authorization grant.
 */
export const API_KEY_PREFIX = "pdak_";
const API_KEY_VERSION = "v1";
const PUBLIC_ID_BYTES = 16;
const SECRET_BYTES = 32;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const DEVELOPMENT_AUTH_SECRET = "personal-dashboard-development-session-secret";

export type ParsedApiKey = {
  keyId: string;
  secret: string;
};

export type ApiKeyMaterial = ParsedApiKey & {
  /** Return this once to the caller. Do not include it in logs or errors. */
  apiKey: string;
  secretHash: string;
  encryptedSecret: string;
};

export type GeneratedApiKey = {
  /** Public, non-secret database identifier. */
  keyId: string;
  /** Return this once to the caller. Do not include it in logs or errors. */
  apiKey: string;
  secret: string;
  secretHash: string;
  encryptedSecret: string;
};

/** Minimal persisted shape used by the Bearer authentication helper. */
export type ApiKeyAuthenticationRecord = {
  id: string;
  secretHash: string;
  revokedAt: string | null;
};

type ScryptHash = {
  salt: Buffer;
  digest: Buffer;
};

const encodeScryptHash = ({ salt, digest }: ScryptHash) =>
  `scrypt-v1.${salt.toString("base64url")}.${digest.toString("base64url")}`;

const decodeScryptHash = (encoded: string): ScryptHash | null => {
  const [version, saltText, digestText, ...extra] = encoded.split(".");
  if (version !== "scrypt-v1" || !saltText || !digestText || extra.length > 0) return null;

  try {
    const salt = Buffer.from(saltText, "base64url");
    const digest = Buffer.from(digestText, "base64url");
    if (salt.length !== 16 || digest.length !== SCRYPT_KEY_LENGTH) return null;
    return { salt, digest };
  } catch {
    return null;
  }
};

const scryptDigest = (secret: string, salt: Buffer) =>
  scryptSync(secret, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY,
  });

// Used for unknown, revoked, and malformed persisted rows so Bearer lookup
// does not turn the existence of a valid public id into an easy timing oracle.
const DUMMY_SECRET_HASH = encodeScryptHash({
  salt: Buffer.alloc(16),
  digest: scryptDigest("not-an-api-key", Buffer.alloc(16)),
});

const authSecret = () => {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be configured in production");
  }
  return DEVELOPMENT_AUTH_SECRET;
};

const encryptionKey = (secret = authSecret()) =>
  createHash("sha256")
    .update("personal-dashboard/api-key-encryption/v1\0")
    .update(secret, "utf8")
    .digest();

export const formatApiKey = ({ keyId, secret }: ParsedApiKey) =>
  `${API_KEY_PREFIX}${keyId}.${secret}`;

export const parseApiKey = (value: string): ParsedApiKey | null => {
  const match = new RegExp(`^${API_KEY_PREFIX}([A-Za-z0-9_-]{22})\\.([A-Za-z0-9_-]{43})$`).exec(value);
  if (!match) return null;

  const [, keyId, secret] = match;
  try {
    if (
      Buffer.from(keyId!, "base64url").length !== PUBLIC_ID_BYTES
      || Buffer.from(secret!, "base64url").length !== SECRET_BYTES
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return { keyId: keyId!, secret: secret! };
};

/** Returns null for a missing, malformed, or non-Bearer authorization header. */
export const parseBearerApiKey = (authorization: string | null): ParsedApiKey | null => {
  if (!authorization) return null;
  const match = /^Bearer +([^\s]+)$/i.exec(authorization);
  return match ? parseApiKey(match[1]!) : null;
};

export const hashApiKeySecret = (secret: string) => {
  const salt = randomBytes(16);
  return encodeScryptHash({ salt, digest: scryptDigest(secret, salt) });
};

/**
 * Compares fixed-size scrypt digests with `timingSafeEqual`. Invalid stored
 * values use a dummy hash, keeping the public API failure shape uniform.
 */
export const verifyApiKeySecret = (secret: string, storedHash: string) => {
  const parsed = decodeScryptHash(storedHash) ?? decodeScryptHash(DUMMY_SECRET_HASH)!;
  const candidate = scryptDigest(secret, parsed.salt);
  return timingSafeEqual(candidate, parsed.digest) && decodeScryptHash(storedHash) !== null;
};

/**
 * Encrypts only the secret portion. `AUTH_SECRET` is the current key-encryption
 * key material; v1 intentionally has no keyring. Rotating AUTH_SECRET makes
 * old encrypted secrets unrecoverable, so deployments must rotate API keys
 * before changing AUTH_SECRET (or add a versioned previous-secret keyring).
 */
export const encryptApiKeySecret = (secret: string, secretForEncryption?: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secretForEncryption), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [API_KEY_VERSION, iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
};

export const decryptApiKeySecret = (encryptedSecret: string, secretForEncryption?: string) => {
  const [version, ivText, ciphertextText, tagText, ...extra] = encryptedSecret.split(".");
  if (version !== API_KEY_VERSION || !ivText || !ciphertextText || !tagText || extra.length > 0) {
    return null;
  }
  try {
    const iv = Buffer.from(ivText, "base64url");
    const ciphertext = Buffer.from(ciphertextText, "base64url");
    const tag = Buffer.from(tagText, "base64url");
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secretForEncryption), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
};

export const createApiKeyMaterial = (secretForEncryption?: string): ApiKeyMaterial => {
  const keyId = randomBytes(PUBLIC_ID_BYTES).toString("base64url");
  const secret = randomBytes(SECRET_BYTES).toString("base64url");
  return {
    keyId,
    secret,
    apiKey: formatApiKey({ keyId, secret }),
    secretHash: hashApiKeySecret(secret),
    encryptedSecret: encryptApiKeySecret(secret, secretForEncryption),
  };
};

/**
 * Public creation contract for the persistence/settings layer. `keyId` is the
 * public locator to store in the primary key column; never use a username as a
 * lookup component.
 */
export const generateApiKey = (secretForEncryption?: string): GeneratedApiKey => {
  const material = createApiKeyMaterial(secretForEncryption);
  return {
    keyId: material.keyId,
    apiKey: material.apiKey,
    secret: material.secret,
    secretHash: material.secretHash,
    encryptedSecret: material.encryptedSecret,
  };
};

/** Reconstructs the full key only after a separately authenticated web-session check. */
export const revealApiKey = (
  record: Pick<ApiKeyAuthenticationRecord, "id"> & { encryptedSecret: string },
  secretForEncryption?: string
) => {
  const secret = decryptApiKeySecret(record.encryptedSecret, secretForEncryption);
  if (!secret) return null;
  const apiKey = formatApiKey({ keyId: record.id, secret });
  return parseApiKey(apiKey) ? apiKey : null;
};

/**
 * Authenticates a Bearer key without exposing whether a public id exists or is
 * revoked. Route handlers must still whitelist this credential to capture-only
 * endpoints; a successful key is not a web session.
 */
export const authenticateBearerApiKey = <T extends ApiKeyAuthenticationRecord>(
  authorization: string | null,
  lookupById: (publicId: string) => T | undefined
): T | null => {
  const parsed = parseBearerApiKey(authorization);
  if (!parsed) return null;
  const record = lookupById(parsed.keyId);
  const verified = verifyApiKeySecret(parsed.secret, record?.secretHash ?? DUMMY_SECRET_HASH);
  return record && record.revokedAt === null && verified ? record : null;
};
