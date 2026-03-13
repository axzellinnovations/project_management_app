export interface User {
    email: string;
    username?: string;
}

interface JwtPayload {
    sub?: string;
    username?: string;
    exp?: number;
}

export function getUserFromToken(): User | null {
    if (typeof window === 'undefined') return null;

    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
        const tokenParts = token.split('.');
        if (tokenParts.length < 2) {
            localStorage.removeItem('token');
            return null;
        }

        // Simple JWT decoding (payload is the second part)
        const base64Url = tokenParts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload: JwtPayload = JSON.parse(jsonPayload);
        if (!payload.sub) {
            localStorage.removeItem('token');
            return null;
        }

        // If token is expired, clear it and treat user as logged out.
        if (payload.exp && payload.exp * 1000 <= Date.now()) {
            localStorage.removeItem('token');
            return null;
        }

        return {
            email: payload.sub, // 'sub' is standard for subject (email in this case)
            username: payload.username // Custom claim
        };
    } catch (error) {
        console.error("Failed to decode token:", error);
        return null;
    }
}
