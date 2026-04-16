'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '@/navBar/SidebarLayout';
import { AUTH_TOKEN_CHANGED_EVENT, getValidToken } from '@/lib/auth';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();

    useEffect(() => {
        const ensureAuthenticated = () => {
            if (getValidToken()) return;
            router.replace('/login');
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === 'token' || event.key === 'rememberMe' || event.key === null) {
                ensureAuthenticated();
            }
        };

        ensureAuthenticated();

        window.addEventListener('storage', handleStorage);
        window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, ensureAuthenticated);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, ensureAuthenticated);
        };
    }, [router]);

    return (
        <SidebarLayout>
            <main className="flex-1 flex flex-col min-h-full bg-white px-4 md:px-8 pt-4 pb-0 md:pb-8">
                {children}
            </main>
        </SidebarLayout>
    );
}
