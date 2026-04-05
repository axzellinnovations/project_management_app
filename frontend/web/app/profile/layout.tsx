'use client';

import { Suspense } from 'react';
import SidebarLayout from '@/navBar/SidebarLayout';

export default function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarLayout>
            <main className="flex-1 overflow-y-auto bg-[#F7F8FA]">
                {children}
            </main>
        </SidebarLayout>
    );
}

