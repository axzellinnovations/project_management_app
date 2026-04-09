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

// Remember-me helpers

/** Persist the user's "remember me" preference (stored in localStorage itself so
 *  it survives a browser restart and controls where the tokens are kept). */
export function setRememberMe(remember: boolean): void {
    if (typeof window === 'undefined') return;
    if (remember) {
        localStorage.setItem('rememberMe', 'true');
    } else {
        localStorage.removeItem('rememberMe');
    }
}

export function getRememberMe(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('rememberMe') === 'true';
}

/** Pick the right storage based on the rememberMe flag.
 *  - rememberMe=true  -> localStorage  (survives browser restart)
 *  - rememberMe=false -> sessionStorage (cleared when the tab/window closes) */
function tokenStorage(): Storage {
    return getRememberMe() ? localStorage : sessionStorage;
}

// Token helpers

export function getUserFromToken(): User | null {
    if (typeof window === 'undefined') return null;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return null;

    try {
        const tokenParts = token.split('.');
        if (tokenParts.length < 2) {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            return null;
        }

        const base64Url = tokenParts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload: JwtPayload = JSON.parse(jsonPayload);
        if (!payload.sub) {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            return null;
        }

        if (payload.exp && payload.exp * 1000 <= Date.now()) {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            return null;
        }

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

export function saveToken(token: string): void {
    if (typeof window !== 'undefined') {
        tokenStorage().setItem('token', token);
        emitAuthTokenChanged();
    }
}

export function saveRefreshToken(token: string): void {
    if (typeof window !== 'undefined') {
        tokenStorage().setItem('refreshToken', token);
    }
}

export function getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
}

export function clearTokens(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userProfile');
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('refreshToken');
        emitAuthTokenChanged();
    }
}

/**
 * Returns the JWT token only if it's present and not expired.
 * Checks both storages to handle transitions between remember / no-remember sessions.
 */
export function getValidToken(): string | null {
    if (typeof window === 'undefined') return null;
    if (getUserFromToken()) {
        return localStorage.getItem('token') || sessionStorage.getItem('token');
    }
    return null;
}

