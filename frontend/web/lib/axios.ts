import axios from "axios";

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
        const authEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/forgot', '/api/auth/reset', '/api/auth/reg/verify', '/api/auth/resend'];
        const isAuthEndpoint = authEndpoints.some(endpoint => config.url?.includes(endpoint));
        
        if (!isAuthEndpoint && typeof window !== 'undefined') {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
                console.debug('[Axios] Bearer token added for request:', config.url);
            } else {
                console.warn('[Axios] No token found in localStorage for request:', config.url);
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Don't redirect if this is a login or auth endpoint
            const authEndpoints = ['/api/auth/login', '/api/auth/forgot', '/api/auth/reset', '/api/auth/register', '/api/auth/reg/verify'];
            const isAuthEndpoint = authEndpoints.some(endpoint => error.config?.url?.includes(endpoint));
            
            if (!isAuthEndpoint) {
                console.warn('[Axios] 401 Unauthorized - Token may be expired');
                // Token expired or invalid - redirect to login
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;

