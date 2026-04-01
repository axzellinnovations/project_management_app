'use client';

import { Suspense } from 'react';
import SidebarLayout from '@/app/nav/SidebarLayout';
import TopBar from '@/app/nav/TopBar';

export default function FoldersLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarLayout>
            <Suspense fallback={null}><TopBar /></Suspense>
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F7F8FA] p-3 sm:p-6 pb-28 sm:pb-8">
                <Suspense fallback={null}>
                    {children}
                </Suspense>
            </main>
        </SidebarLayout>
    );
}
