'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '@/navBar/SidebarLayout';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.replace('/login');
            return;
        }

        const handleStorage = (event: StorageEvent) => {
            if (event.key === 'token' && !event.newValue) {
                router.replace('/login');
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [router]);

    return (
        <SidebarLayout>
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-white px-4 md:px-8 pt-4 pb-8">
                {children}
            </main>
        </SidebarLayout>
    );
}
