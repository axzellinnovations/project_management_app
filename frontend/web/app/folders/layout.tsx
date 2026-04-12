'use client';

import { Suspense } from 'react';
import SidebarLayout from '@/navBar/SidebarLayout';

export default function FoldersLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarLayout>
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F7F8FA] p-3 sm:p-6 pb-6">
                <Suspense fallback={null}>
                    {children}
                </Suspense>
            </main>
        </SidebarLayout>
    );
}
