import { initializeSessionCacheForCurrentAuth } from '@/lib/session-cache';
import { getApiBaseUrl } from '@/lib/api-base-url';

export interface User {
    email: string;
    username?: string;
    fullName?: string;
    userId?: number;
    exp?: number;
}

export const AUTH_TOKEN_CHANGED_EVENT = 'planora-auth-token-changed';

const TOKEN_KEY = 'planora:access_token';
const REFRESH_TOKEN_KEY = 'planora:refresh_token';
const REFRESH_TOKEN_MARKER_KEY = 'planora:has_refresh_token';
const AUTH_SYNC_KEY = 'planora:auth_sync';
const REFRESH_LOCK_KEY = 'planora:refresh_lock';
const REFRESH_LOCK_TIMEOUT_MS = 10_000;
const REFRESH_LOCK_POLL_MS = 75;
const AUTH_BROADCAST_CHANNEL = 'planora-auth';

interface JwtPayload {
    sub?: string;
    username?: string;
    exp?: number;
}

let refreshAccessTokenPromise: Promise<string> | null = null;
let authSyncListenerInstalled = false;
let authBroadcastChannel: BroadcastChannel | null = null;
let authLogoutInProgress = false;
let authStateGeneration = 0;
const authTabId = Math.random().toString(36).slice(2);

type AuthSyncType = 'login' | 'logout';

interface RefreshAccessTokenOptions {
    allowCookieRefresh?: boolean;
}

type EnsureValidTokenOptions = RefreshAccessTokenOptions;

interface AuthSyncMessage {
    type?: AuthSyncType;
    token?: string | null;
    sourceTabId?: string;
    issuedAt?: number;
}

function debugAuthSyncFailure(
    operation: string,
    error: unknown,
    context: Record<string, unknown> = {},
): void {
    console.debug('[auth-sync] Best-effort sync operation failed', {
        operation,
        ...context,
        error,
    });
}

function emitAuthTokenChanged(): void {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
    }
}

function markAuthActive(): void {
    authLogoutInProgress = false;
}

function markAuthLoggedOut(): void {
    authLogoutInProgress = true;
    authStateGeneration += 1;
}

function setMemoryAccessToken(token: string): void {
    markAuthActive();
    memoryToken = token;
    initializeSessionCacheForCurrentAuth(token);
    emitAuthTokenChanged();
}

function handleAuthBroadcastMessage(event: MessageEvent<AuthSyncMessage>): void {
    const message = event.data;
    if (!message || message.sourceTabId === authTabId) return;

    if (message.type === 'logout') {
        markAuthLoggedOut();
        clearLocalAuthState();
        emitAuthTokenChanged();
        return;
    }

    if (message.type === 'login' && message.token) {
        localStorage.setItem(REFRESH_TOKEN_MARKER_KEY, 'true');
        sessionStorage.removeItem(REFRESH_TOKEN_MARKER_KEY);
        setMemoryAccessToken(message.token);
    }
}

function getAuthBroadcastChannel(): BroadcastChannel | null {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
        return null;
    }

    if (!authBroadcastChannel) {
        authBroadcastChannel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
        authBroadcastChannel.onmessage = handleAuthBroadcastMessage;
    }

    return authBroadcastChannel;
}

function broadcastAuthSync(type: AuthSyncType, token?: string | null): void {
    if (typeof window === 'undefined') return;
    const message: AuthSyncMessage = {
        type,
        token: token || null,
        sourceTabId: authTabId,
        issuedAt: Date.now(),
    };

    try {
        getAuthBroadcastChannel()?.postMessage(message);
    } catch (error) {
        debugAuthSyncFailure('broadcast-channel-post', error, { type });
        // BroadcastChannel sync is best-effort; storage sync remains as fallback.
    }

    try {
        localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify({
            type,
            issuedAt: message.issuedAt,
            id: Math.random().toString(36).slice(2),
        }));
    } catch (error) {
        debugAuthSyncFailure('storage-sync-write', error, { type });
        // Storage sync is best-effort; same-tab auth still works without it.
    }
}

function clearLocalAuthState(): void {
    memoryToken = null;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('userProfile');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem(REFRESH_TOKEN_MARKER_KEY);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem(REFRESH_TOKEN_MARKER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);

    Object.keys(localStorage)
        .filter((k) => k.startsWith('planora:') && k !== AUTH_SYNC_KEY)
        .forEach((k) => localStorage.removeItem(k));
    Object.keys(sessionStorage)
        .filter((k) => k.startsWith('planora:'))
        .forEach((k) => sessionStorage.removeItem(k));
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function tryAcquireRefreshLock(): boolean {
    const now = Date.now();
    try {
        const rawLock = localStorage.getItem(REFRESH_LOCK_KEY);
        if (rawLock) {
            const lock = JSON.parse(rawLock) as { owner?: string; issuedAt?: number };
            const lockIsFresh = typeof lock.issuedAt === 'number'
                && now - lock.issuedAt < REFRESH_LOCK_TIMEOUT_MS;
            if (lock.owner && lock.owner !== authTabId && lockIsFresh) {
                return false;
            }
        }
    } catch (error) {
        debugAuthSyncFailure('refresh-lock-read', error);
        // A malformed lock should not block auth recovery.
    }

    try {
        localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ owner: authTabId, issuedAt: now }));
        const lock = JSON.parse(localStorage.getItem(REFRESH_LOCK_KEY) || '{}') as { owner?: string };
        return lock.owner === authTabId;
    } catch (error) {
        debugAuthSyncFailure('refresh-lock-write', error);
        return true;
    }
}

async function acquireRefreshLock(): Promise<() => void> {
    if (typeof window === 'undefined') return () => undefined;

    const startedAt = Date.now();
    while (!tryAcquireRefreshLock()) {
        if (Date.now() - startedAt > REFRESH_LOCK_TIMEOUT_MS * 2) {
            throw new Error('Timed out waiting for refresh lock');
        }
        await sleep(REFRESH_LOCK_POLL_MS);
    }

    return () => {
        try {
            const lock = JSON.parse(localStorage.getItem(REFRESH_LOCK_KEY) || '{}') as { owner?: string };
            if (lock.owner === authTabId) {
                localStorage.removeItem(REFRESH_LOCK_KEY);
            }
        } catch (error) {
            debugAuthSyncFailure('refresh-lock-release', error);
            localStorage.removeItem(REFRESH_LOCK_KEY);
        }
    };
}

function handleCrossTabAuthEvent(event: StorageEvent): void {
    if (event.key === REFRESH_TOKEN_MARKER_KEY && event.newValue === null) {
        markAuthLoggedOut();
        clearLocalAuthState();
        emitAuthTokenChanged();
        return;
    }

    if (event.key !== AUTH_SYNC_KEY || !event.newValue) return;

    try {
        const message = JSON.parse(event.newValue) as { type?: string };
        if (message.type === 'logout') {
            markAuthLoggedOut();
            clearLocalAuthState();
            emitAuthTokenChanged();
        } else if (message.type === 'login') {
            markAuthActive();
            window.setTimeout(emitAuthTokenChanged, 100);
        }
    } catch (error) {
        debugAuthSyncFailure('storage-sync-parse', error, { key: event.key });
        // Ignore malformed messages from storage.
    }
}

function ensureAuthSyncListener(): void {
    if (typeof window === 'undefined' || authSyncListenerInstalled) return;
    window.addEventListener('storage', handleCrossTabAuthEvent);
    getAuthBroadcastChannel();
    authSyncListenerInstalled = true;
}

ensureAuthSyncListener();

// Remember-me helpers

/** Persist the user's "remember me" preference (stored in localStorage itself so
 *  it survives a browser restart and controls where the tokens are kept). */
export function setRememberMe(remember: boolean): void {
    if (typeof window === 'undefined') return;
    ensureAuthSyncListener();
    markAuthActive();
    if (remember) {
        localStorage.setItem('rememberMe', 'true');
    } else {
        localStorage.removeItem('rememberMe');
    }
}

export function getRememberMe(): boolean {
    if (typeof window === 'undefined') return false;
    ensureAuthSyncListener();
    return localStorage.getItem('rememberMe') === 'true';
}

/**
 * ARCHITECTURE DECISION RECORD (ADR): Token Storage Strategy
 * 
 * - Refresh Token: Stored in a secure, HttpOnly cookie on the backend.
 * - Access Token: Stored in an in-memory module variable (`memoryToken`) to close the XSS
 *   vulnerability storage exposure window. The token is lost on page reload and re-minted
 *   via the HttpOnly refresh token cookie on app boot or tab load.
 * - localStorage: Kept only for a non-sensitive refresh-cookie marker and auth event
 *   marker so tabs can silently mint their own access token and react to logout.
 */
let memoryToken: string | null = null;

function getOrMigrateToken(): string | null {
    if (typeof window === 'undefined') return null;
    ensureAuthSyncListener();
    if (!memoryToken) {
        const legacyToken = localStorage.getItem(TOKEN_KEY)
            || localStorage.getItem('token')
            || sessionStorage.getItem(TOKEN_KEY)
            || sessionStorage.getItem('token');
        if (legacyToken) {
            memoryToken = legacyToken;
            localStorage.removeItem('planora:access_token');
            localStorage.removeItem('token');
            sessionStorage.removeItem('planora:access_token');
            sessionStorage.removeItem('token');
        }
    }
    return memoryToken;
}

// Token helpers

export function getUserFromToken(): User | null {
    if (typeof window === 'undefined') return null;
    ensureAuthSyncListener();

    const token = getOrMigrateToken();
    if (!token) return null;

    try {
        const tokenParts = token.split('.');
        if (tokenParts.length < 2) {
            clearTokens();
            return null;
        }

        const base64Url = tokenParts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload: JwtPayload = JSON.parse(jsonPayload);
        if (!payload.sub) {
            clearTokens();
            return null;
        }

        if (payload.exp && payload.exp * 1000 <= Date.now()) {
            return null;
        }

        type ExtendedJwtPayload = JwtPayload & { userId?: number; id?: number };
        const extPayload = payload as ExtendedJwtPayload;
        let userId: number | undefined = undefined;
        if (extPayload.userId != null) userId = Number(extPayload.userId);
        else if (typeof extPayload.id === 'number') userId = extPayload.id;

        const decodedUser: User = {
            email: payload.sub,
            username: payload.username,
            userId,
            exp: payload.exp,
        };

        const cachedProfile = localStorage.getItem('userProfile');
        if (cachedProfile) {
            try {
                const parsedProfile = JSON.parse(cachedProfile) as User;
                if (parsedProfile.email?.toLowerCase() === decodedUser.email?.toLowerCase()) {
                    return {
                        ...decodedUser,
                        username: parsedProfile.username || decodedUser.username,
                        fullName: parsedProfile.fullName,
                    };
                }
            } catch {
                localStorage.removeItem('userProfile');
            }
        }

        return decodedUser;
    } catch {
        return null;
    }
}

export function getUserIdFromToken(): number | null {
    const user = getUserFromToken();
    return user?.userId ?? null;
}

export function saveToken(token: string): void {
    if (typeof window !== 'undefined') {
        ensureAuthSyncListener();
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        setMemoryAccessToken(token);
    }
}

export function saveRefreshToken(_token: string, options: { broadcast?: boolean } = {}): void {
    if (typeof window !== 'undefined') {
        ensureAuthSyncListener();
        markAuthActive();
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem('refreshToken');
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        sessionStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.setItem(REFRESH_TOKEN_MARKER_KEY, 'true');
        sessionStorage.removeItem(REFRESH_TOKEN_MARKER_KEY);

        if (options.broadcast) {
            broadcastAuthSync('login', memoryToken);
        }
    }
}

export function getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    ensureAuthSyncListener();
    return localStorage.getItem(REFRESH_TOKEN_MARKER_KEY) === 'true'
        || sessionStorage.getItem(REFRESH_TOKEN_MARKER_KEY) === 'true'
        ? 'true'
        : null;
}

export function clearTokens(): void {
    if (typeof window !== 'undefined') {
        ensureAuthSyncListener();
        markAuthLoggedOut();
        clearLocalAuthState();

        // Non-blocking logout call to clear HttpOnly cookie
        fetch(`${getApiBaseUrl()}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        }).catch((err) => console.error('Failed to logout backend session', err));

        broadcastAuthSync('logout');
        emitAuthTokenChanged();
    }
}

/**
 * Returns the JWT token only if it's present and not expired.
 * Checks both storages to handle transitions between remember / no-remember sessions.
 */
export function getValidToken(): string | null {
    if (typeof window === 'undefined') return null;
    ensureAuthSyncListener();
    if (getUserFromToken()) {
        return memoryToken;
    }
    return null;
}

/**
 * Uses native fetch (not axios) to avoid circular imports.
 * POSTs the current refresh token to /api/auth/refresh, stores the new
 * access token (and refresh token if rotated), and returns the new access token.
 *
 * IMPORTANT: Only calls clearTokens() on an explicit 401 Unauthorized response,
 * which means the refresh token is genuinely expired or revoked. On network errors
 * (ECONNREFUSED, TypeError) or 5xx server errors (backend rebooting/deploying), we
 * throw WITHOUT clearing credentials so the session survives the outage.
 */
async function requestRefreshAccessToken(_options: RefreshAccessTokenOptions = {}): Promise<string> {
    if (authLogoutInProgress) {
        throw new Error('Token refresh cancelled during logout');
    }

    const rt = getRefreshToken();
    if (!rt) {
        clearTokens();
        throw new Error('No refresh token available');
    }
    const refreshGeneration = authStateGeneration;
    const releaseRefreshLock = await acquireRefreshLock();
    try {
        if (authLogoutInProgress || refreshGeneration !== authStateGeneration) {
            throw new Error('Token refresh cancelled during logout');
        }

        // Fast-path: Check if another tab or concurrent caller already refreshed and synced a valid token
        const existingToken = getValidToken();
        if (existingToken) {
            const user = getUserFromToken();
            if (user?.exp && (user.exp * 1000 - Date.now()) > 30_000) {
                return existingToken;
            }
        }

        let res: Response;
        try {
            res = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
        } catch {
            // Network-level failure (backend down, CORS preflight, etc.).
            // Do NOT clear tokens — the user is still authenticated; the server is just temporarily unreachable.
            throw new Error('Token refresh failed: network error');
        }

        if (res.status === 401 || res.status === 403) {
            // The refresh token is genuinely expired or revoked — force logout.
            clearTokens();
            throw new Error('Token refresh failed: session expired');
        }

        if (!res.ok) {
            // 4xx (bad request, missing cookie) or 5xx (server error, deploying) —
            // do NOT clear tokens; the session may still be valid once the issue resolves.
            throw new Error(`Token refresh failed: server returned ${res.status}`);
        }

        const data = await res.json();

        if (authLogoutInProgress || refreshGeneration !== authStateGeneration) {
            throw new Error('Token refresh cancelled during logout');
        }

        const newAccessToken = data?.token || data?.accessToken;
        if (!newAccessToken) {
            // Malformed but not a 401, so don't logout.
            throw new Error('Token refresh response missing access token');
        }

        saveToken(newAccessToken);
        saveRefreshToken('true', { broadcast: true });
        return newAccessToken;
    } finally {
        releaseRefreshLock();
    }
}


export function refreshAccessToken(options: RefreshAccessTokenOptions = {}): Promise<string> {
    if (!refreshAccessTokenPromise) {
        refreshAccessTokenPromise = requestRefreshAccessToken(options).finally(() => {
            refreshAccessTokenPromise = null;
        });
    }
    return refreshAccessTokenPromise;
}

/**
 * Returns a usable access token, refreshing it first when the short-lived token
 * has expired but the 30-day refresh token is still available.
 */
export async function ensureValidToken(options: EnsureValidTokenOptions = {}): Promise<string | null> {
    const token = getValidToken();
    if (token) return token;

    if (authLogoutInProgress) return null;

    if (!getRefreshToken()) return null;

    try {
        return await refreshAccessToken(options);
    } catch {
        return null;
    }
}

/** Alias for clearTokens — clears all auth state and planora: caches. */
export function logout(): void {
    clearTokens();
}
