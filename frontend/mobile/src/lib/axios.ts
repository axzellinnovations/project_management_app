import { create } from 'axios';
import { clearTokens, getRefreshToken, getValidToken, getUserFromToken, refreshAccessToken } from './auth';
import { router } from 'expo-router';
import { resolveApiBaseUrl } from '../api/baseUrl';

const api = create({
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Dynamically resolve the base URL on every request so that
// Constants.expoConfig.hostUri (which carries the real LAN IP when using
// Expo Go on a physical device) is guaranteed to be populated by the time
// the first request fires — unlike a static export evaluated at module load.
api.interceptors.request.use(
  (config) => {
    if (!config.baseURL && !config.url?.startsWith('http')) {
      config.baseURL = resolveApiBaseUrl();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Unified request interceptor to handle auth token attachment and proactive refresh
api.interceptors.request.use(
  async (config) => {
    const authEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/forgot', '/api/auth/reset', '/api/auth/reg/verify', '/api/auth/resend', '/api/auth/refresh'];
    const isAuthEndpoint = authEndpoints.some(endpoint => config.url?.includes(endpoint));

    if (!isAuthEndpoint) {
      try {
        let token = await getValidToken();
        const refreshToken = await getRefreshToken();
        const user = await getUserFromToken();
        const needsRefresh = !token || (user?.exp && (user.exp - Date.now() / 1000) < 60);

        if (needsRefresh && refreshToken) {
          token = await refreshAccessToken();
        }

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        const token = await getValidToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Track whether a token refresh is in progress to avoid infinite loop
let isRefreshing = false;
let failedQueue: { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }[] = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't attempt refresh on auth endpoints
    const authEndpoints = ['/api/auth/login', '/api/auth/forgot', '/api/auth/reset', '/api/auth/register', '/api/auth/reg/verify', '/api/auth/refresh'];
    const isAuthEndpoint = authEndpoints.some(endpoint => originalRequest?.url?.includes(endpoint));

    if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for the in-progress refresh to complete, then retry
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        isRefreshing = false;
        await clearTokens();
        // 500ms delay lets toast notifications render before navigation
        setTimeout(() => { router.replace('/(auth)/login'); }, 500);
        return Promise.reject(error);
      }

      try {
        const newAccessToken = await refreshAccessToken();
        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        const message = refreshError instanceof Error ? refreshError.message : '';
        if (message.includes('session expired')) {
          await clearTokens();
          // 500ms delay lets toast notifications render before navigation
          setTimeout(() => { router.replace('/(auth)/login'); }, 500);
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
