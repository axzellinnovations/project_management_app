import { DeviceEventEmitter, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { buildApiUrl } from '../api/baseUrl';

export interface User {
  email: string;
  username?: string;
  fullName?: string;
  userId?: number;
  exp?: number;
}

export const AUTH_TOKEN_CHANGED_EVENT = 'planora-auth-token-changed';

export type AuthTokenChangedReason = 'save' | 'refresh' | 'clear';

export interface AuthTokenChangedPayload {
  token: string | null;
  reason: AuthTokenChangedReason;
}

const TOKEN_KEY = 'planora_access_token';
const REFRESH_TOKEN_KEY = 'planora_refresh_token';
const REMEMBER_KEY = 'planora_remember_me';

const store = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async delete(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

function emitAuthTokenChanged(payload: AuthTokenChangedPayload): void {
  if (Platform.OS === 'web') {
    globalThis.window?.dispatchEvent(new CustomEvent(AUTH_TOKEN_CHANGED_EVENT, { detail: payload }));
    return;
  }

  DeviceEventEmitter.emit(AUTH_TOKEN_CHANGED_EVENT, payload);
}

export async function setRememberMe(remember: boolean): Promise<void> {
  if (remember) {
    await store.set(REMEMBER_KEY, 'true');
  } else {
    await store.delete(REMEMBER_KEY);
  }
}

export async function getRememberMe(): Promise<boolean> {
  return (await store.get(REMEMBER_KEY)) === 'true';
}

export function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = globalThis.atob(padded);
    const jsonPayload = decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export async function getUserFromToken(): Promise<User | null> {
  try {
    const token = await store.get(TOKEN_KEY);
    if (!token) return null;

    const payload = decodeJwtPayload(token);
    if (!payload || !payload.sub) {
      await clearTokens();
      return null;
    }

    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      return null;
    }

    const userId = payload.userId ?? payload.id;
    const decodedUser: User = {
      email: payload.sub,
      username: payload.username,
      userId: typeof userId === 'number' ? userId : undefined,
      exp: payload.exp,
    };

    const cachedProfile = await store.get('planora_user_profile');
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
        await store.delete('planora_user_profile');
      }
    }

    return decodedUser;
  } catch {
    return null;
  }
}

export async function getUserIdFromToken(): Promise<number | null> {
  const user = await getUserFromToken();
  return user?.userId ?? null;
}

export async function saveToken(token: string): Promise<void> {
  await store.set(TOKEN_KEY, token);
  emitAuthTokenChanged({ token, reason: 'save' });
}

export async function saveRefreshToken(token: string): Promise<void> {
  await store.set(REFRESH_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return store.get(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  await store.delete(TOKEN_KEY);
  await store.delete(REFRESH_TOKEN_KEY);
  await store.delete(REMEMBER_KEY);
  await store.delete('planora_user_profile');
  emitAuthTokenChanged({ token: null, reason: 'clear' });
}

export async function getValidToken(): Promise<string | null> {
  const user = await getUserFromToken();
  if (user) {
    return store.get(TOKEN_KEY);
  }
  return null;
}

let refreshAccessTokenPromise: Promise<string> | null = null;

async function requestRefreshAccessToken(): Promise<string> {
  const rt = await getRefreshToken();
  if (!rt) {
    await clearTokens();
    throw new Error('No refresh token available');
  }

  const refreshUrl = buildApiUrl('/api/auth/refresh');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let res: Response;
  try {
    res = await fetch(refreshUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      await clearTokens();
      throw new Error('Token refresh failed: session expired');
    }
    throw new Error(`Token refresh failed: server returned ${res.status}`);
  }

  const data = await res.json();
  await store.set(TOKEN_KEY, data.token);
  if (data.refreshToken) {
    await saveRefreshToken(data.refreshToken);
  }
  emitAuthTokenChanged({ token: data.token, reason: 'refresh' });
  return data.token;
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshAccessTokenPromise) {
    refreshAccessTokenPromise = requestRefreshAccessToken().finally(() => {
      refreshAccessTokenPromise = null;
    });
  }
  return refreshAccessTokenPromise;
}

export async function ensureValidToken(): Promise<string | null> {
  const token = await getValidToken();
  if (token) return token;

  const rt = await getRefreshToken();
  if (!rt) return null;

  try {
    return await refreshAccessToken();
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await clearTokens();
}
