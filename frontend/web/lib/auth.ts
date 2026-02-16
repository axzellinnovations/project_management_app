export interface User {
    email: string;
    username?: string;
}

export function getUserFromToken(): User | null {
    if (typeof window === 'undefined') return null;

    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
        // Simple JWT decoding (payload is the second part)
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);

        return {
            email: payload.sub, // 'sub' is standard for subject (email in this case)
            username: payload.username // Custom claim
        };
    } catch (error) {
        console.error("Failed to decode token:", error);
        return null;
    }
}
