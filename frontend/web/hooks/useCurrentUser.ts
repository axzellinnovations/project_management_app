'use client';

import useSWR from 'swr';
import api from '@/lib/axios';

interface UserProfile {
    email?: string;
    username?: string;
    fullName?: string;
    profilePicUrl?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

function resolveUrl(url: string | undefined | null): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL}${url}`;
}

const fetcher = (url: string) => api.get<UserProfile>(url).then(r => r.data);

export function useCurrentUser() {
    const { data, error, isLoading } = useSWR<UserProfile>('/api/user/profile', fetcher, {
        dedupingInterval: 3_600_000, // 1 hour — re-use across Sidebar + TopBar
        revalidateOnFocus: false,
    });

    return {
        user: data,
        profilePicUrl: resolveUrl(data?.profilePicUrl),
        error,
        isLoading,
    };
}
