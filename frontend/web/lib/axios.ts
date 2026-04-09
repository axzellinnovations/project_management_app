import axios from "axios";
import { clearTokens, getRefreshToken, getValidToken, saveRefreshToken, saveToken } from "@/lib/auth";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
    headers: {
        'Content-Type': 'application/json'
    },
});

// Add request interceptor to include auth token (exclude auth endpoints)
api.interceptors.request.use(
    (config) => {
        // Don't add token to auth endpoints
        const authEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/forgot', '/api/auth/reset', '/api/auth/reg/verify', '/api/auth/resend', '/api/auth/refresh'];
        const isAuthEndpoint = authEndpoints.some(endpoint => config.url?.includes(endpoint));
        
        if (!isAuthEndpoint && typeof window !== 'undefined') {
            const token = getValidToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Track whether a token refresh is in progress to avoid infinite loop
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

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

            const refreshToken = getRefreshToken();
            if (!refreshToken) {
                isRefreshing = false;
                clearTokens();
                if (typeof window !== 'undefined') window.location.href = '/login';
                return Promise.reject(error);
            }

            try {
                const refreshResponse = await api.post('/api/auth/refresh', { refreshToken });
                const { token: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data;
                saveToken(newAccessToken);
                saveRefreshToken(newRefreshToken);
                processQueue(null, newAccessToken);
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                clearTokens();
                if (typeof window !== 'undefined') window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;

