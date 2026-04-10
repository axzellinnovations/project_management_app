import api from '@/lib/axios';

type UserMapEntry = { username?: string; fullName?: string; profilePicUrl?: string | null };

let userMapCache: Record<string, string | null> | null = null;
let userMapFetchPromise: Promise<Record<string, string | null>> | null = null;

// BUG-7: Module-level singleton so the user list is fetched at most once per
// browser session regardless of how many task cards the user opens.
export function getOrFetchUserMap(): Promise<Record<string, string | null>> {
  if (userMapCache !== null) return Promise.resolve(userMapCache);
  if (userMapFetchPromise !== null) return userMapFetchPromise;

  userMapFetchPromise = api
    .get<UserMapEntry[]>('/api/auth/users')
    .then((response) => {
      const map: Record<string, string | null> = {};
      response.data.forEach((u) => {
        if (u.username) map[u.username] = u.profilePicUrl || null;
        if (u.fullName) map[u.fullName] = u.profilePicUrl || null;
      });
      userMapCache = map;
      userMapFetchPromise = null;
      return map;
    })
    .catch(() => {
      userMapFetchPromise = null;
      return {};
    });

  return userMapFetchPromise;
}
