export interface User {
    email: string;
    username?: string;
    fullName?: string;
    userId?: number;
}

export const AUTH_TOKEN_CHANGED_EVENT = 'planora-auth-token-changed';

interface JwtPayload {
    sub?: string;
    username?: string;
    exp?: number;
}

function emitAuthTokenChanged(): void {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
    }
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

        // Try to extract userId from JWT (commonly as 'userId' or 'id')

        // Extend JwtPayload to include userId and id as possible number fields
        type ExtendedJwtPayload = JwtPayload & { userId?: number; id?: number };
        const extPayload = payload as ExtendedJwtPayload;
        let userId: number | undefined = undefined;
        if (typeof extPayload.userId === 'number') userId = extPayload.userId;
        else if (typeof extPayload.id === 'number') userId = extPayload.id;

        const decodedUser: User = {
            email: payload.sub,
            username: payload.username,
            userId,
        };

        // Keep sidebar/profile displays in sync after profile edits without requiring re-login.
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
    } catch (error) {
        console.error("Failed to decode token:", error);

        return null;
    }
}

export function saveToken(token: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
        emitAuthTokenChanged();
    }
}

export function saveRefreshToken(token: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('refreshToken', token);
    }
}

export function getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
}

export function clearTokens(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userProfile');
        emitAuthTokenChanged();
    }
}

/**
 * Returns the JWT token only if it's present and not expired.
 * Also clears the token from localStorage if it's expired.
 */
export function getValidToken(): string | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('token');
    if (!token) return null;

    // getUserFromToken() internally clears the token if it's expired or malformed.
    if (getUserFromToken()) {
        return localStorage.getItem('token'); // Return the actual token string.
    }
    return null;
}
