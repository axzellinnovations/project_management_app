import api from '@/lib/axios';

type UserMapEntry = {
  userId?: number;
  email?: string;
  username?: string;
  fullName?: string;
  profilePicUrl?: string | null;
};

const USERS_MAP_STORAGE_KEY = 'planora:usersMap';

// Module-level singletons so all callers in the same browser session share one fetch
// and one in-memory copy — avoids a per-component API call on every task card open.
let userMapCache: Record<string, string | null> | null = null;
let userMapFetchPromise: Promise<Record<string, string | null>> | null = null;

function normalizeUsersMap(raw: unknown): Record<string, string | null> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const map: Record<string, string | null> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof key !== 'string' || key.trim().length === 0) return;
    if (typeof value === 'string' || value === null) {
      map[key] = value;
      return;
    }
    if (typeof value === 'object' && value !== null) {
      const nested = value as { profilePicUrl?: unknown };
      if (typeof nested.profilePicUrl === 'string' || nested.profilePicUrl === null) {
        map[key] = nested.profilePicUrl;
      }
    }
  });

  return map;
}

function buildUserMap(users: UserMapEntry[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  users.forEach((u) => {
    const pic = u.profilePicUrl || null;
    if (typeof u.userId === 'number') {
      map[`id:${u.userId}`] = pic;
    }
    if (u.email) {
      map[`email:${u.email.toLowerCase()}`] = pic;
    }
    if (u.username) {
      // Index by both raw username and prefixed lowercase so lookups are case-insensitive
      map[u.username] = pic;
      map[`username:${u.username.toLowerCase()}`] = pic;
    }
    if (u.fullName) {
      map[u.fullName] = pic;
      map[`fullname:${u.fullName.toLowerCase()}`] = pic;
    }
  });
  return map;
}

function readUsersMapFromLocalStorage(): Record<string, string | null> | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USERS_MAP_STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeUsersMap(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeUsersMapToLocalStorage(map: Record<string, string | null>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USERS_MAP_STORAGE_KEY, JSON.stringify(map));
}

// forceRefresh bypasses both the in-memory cache and localStorage so an explicit
// refresh (e.g. after profile picture update) fetches the latest data from the API.
export function getOrFetchUserMap(options?: { forceRefresh?: boolean }): Promise<Record<string, string | null>> {
  const forceRefresh = Boolean(options?.forceRefresh);

  if (!forceRefresh && userMapCache !== null) return Promise.resolve(userMapCache);

  if (!forceRefresh) {
    const localMap = readUsersMapFromLocalStorage();
    if (localMap && Object.keys(localMap).length > 0) {
      userMapCache = localMap;
      return Promise.resolve(localMap);
    }
  }

  if (!forceRefresh && userMapCache !== null) return Promise.resolve(userMapCache);
  if (userMapFetchPromise !== null) return userMapFetchPromise;

  userMapFetchPromise = api
    .get<UserMapEntry[]>('/api/auth/users')
    .then((response) => {
      const map = buildUserMap(Array.isArray(response.data) ? response.data : []);
      userMapCache = map;
      writeUsersMapToLocalStorage(map);
      userMapFetchPromise = null;
      return map;
    })
    .catch(() => {
      userMapFetchPromise = null;
      return {};
    });

  return userMapFetchPromise;
}

export function invalidateUserMapCache(): void {
  userMapCache = null;
  userMapFetchPromise = null;
}

export function upsertUserMapEntry(entry: UserMapEntry): void {
  const next = {
    ...(userMapCache || readUsersMapFromLocalStorage() || {}),
    ...buildUserMap([entry]),
  };
  userMapCache = next;
  writeUsersMapToLocalStorage(next);
}
