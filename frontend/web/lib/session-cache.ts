'use client';

const CACHE_PREFIX = 'planora:session-cache:';
const CACHE_VERSION = 1;
const SESSION_META_KEY = `${CACHE_PREFIX}meta`;

export type SessionCacheEnvelope<T> = {
  version: number;
  savedAt: number;
  expiresAt: number;
  data: T;
};

export type SessionCacheScope = {
  userKey: string;
  sessionKey: string;
};

export type SessionCacheReadResult<T> = {
  data: T | null;
  isStale: boolean;
};

type JwtPayload = {
  sub?: string;
  exp?: number;
  jti?: string;
};

function safeStorageGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore quota/storage availability errors.
  }
}

function safeStorageRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage availability errors.
  }
}

function getRawTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  return safeStorageGet(localStorage, 'token') || safeStorageGet(sessionStorage, 'token');
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length < 2) return null;

    const base64 = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

function normalizeUserKey(value?: string): string {
  if (!value) return 'anonymous';
  return value.trim().toLowerCase();
}

function sanitizeKeyPart(part: string | number): string {
  return String(part).trim().replace(/[^a-zA-Z0-9:_-]/g, '_');
}

function computeSessionKey(payload: JwtPayload): string {
  if (payload.jti && payload.jti.trim().length > 0) {
    return sanitizeKeyPart(payload.jti);
  }

  const sub = normalizeUserKey(payload.sub || 'unknown');
  const exp = typeof payload.exp === 'number' ? payload.exp : 'no-exp';
  return sanitizeKeyPart(`${sub}:${exp}`);
}

export function resolveSessionCacheScope(tokenOverride?: string | null): SessionCacheScope | null {
  const token = tokenOverride || getRawTokenFromStorage();
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload || !payload.sub) return null;

  return {
    userKey: sanitizeKeyPart(normalizeUserKey(payload.sub)),
    sessionKey: computeSessionKey(payload),
  };
}

export function buildSessionCacheKey(
  page: string,
  scopeParts: Array<string | number | null | undefined> = [],
  tokenOverride?: string | null,
): string | null {
  const scope = resolveSessionCacheScope(tokenOverride);
  if (!scope) return null;

  const pagePart = sanitizeKeyPart(page);
  const scoped = scopeParts
    .filter((value): value is string | number => value !== null && value !== undefined && String(value).trim().length > 0)
    .map((value) => sanitizeKeyPart(value));

  const suffix = scoped.length > 0 ? `:${scoped.join(':')}` : '';
  return `${CACHE_PREFIX}${scope.userKey}:${scope.sessionKey}:${pagePart}${suffix}`;
}

export function initializeSessionCacheForCurrentAuth(tokenOverride?: string | null): void {
  if (typeof window === 'undefined') return;

  const scope = resolveSessionCacheScope(tokenOverride);
  if (!scope) return;

  safeStorageSet(
    localStorage,
    SESSION_META_KEY,
    JSON.stringify({
      userKey: scope.userKey,
      sessionKey: scope.sessionKey,
      initializedAt: Date.now(),
    }),
  );
}

export function getSessionCache<T>(
  key: string,
  options: { allowStale?: boolean } = {},
): SessionCacheReadResult<T> {
  if (typeof window === 'undefined') {
    return { data: null, isStale: false };
  }

  const raw = safeStorageGet(localStorage, key);
  if (!raw) {
    return { data: null, isStale: false };
  }

  try {
    const parsed = JSON.parse(raw) as SessionCacheEnvelope<T>;
    if (
      !parsed
      || typeof parsed !== 'object'
      || parsed.version !== CACHE_VERSION
      || typeof parsed.savedAt !== 'number'
      || typeof parsed.expiresAt !== 'number'
      || !('data' in parsed)
    ) {
      safeStorageRemove(localStorage, key);
      return { data: null, isStale: false };
    }

    const isStale = Date.now() > parsed.expiresAt;
    if (isStale && !options.allowStale) {
      safeStorageRemove(localStorage, key);
      return { data: null, isStale: true };
    }

    return { data: parsed.data, isStale };
  } catch {
    safeStorageRemove(localStorage, key);
    return { data: null, isStale: false };
  }
}

export function setSessionCache<T>(key: string, data: T, ttlMs: number): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const envelope: SessionCacheEnvelope<T> = {
    version: CACHE_VERSION,
    savedAt: now,
    expiresAt: now + Math.max(1, ttlMs),
    data,
  };

  safeStorageSet(localStorage, key, JSON.stringify(envelope));
}

export function removeSessionCache(key: string): void {
  if (typeof window === 'undefined') return;
  safeStorageRemove(localStorage, key);
}

export function clearAllSessionCacheData(): void {
  if (typeof window === 'undefined') return;

  Object.keys(localStorage)
    .filter((key) => key.startsWith(CACHE_PREFIX) || key.startsWith('planora:'))
    .forEach((key) => safeStorageRemove(localStorage, key));

  Object.keys(sessionStorage)
    .filter((key) => key.startsWith('planora:'))
    .forEach((key) => safeStorageRemove(sessionStorage, key));
}
