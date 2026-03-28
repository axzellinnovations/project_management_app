'use client';

import { Suspense } from 'react';
import Sidebar from '@/app/nav/Sidebar';
import TopBar from '@/app/nav/TopBar';

export default function FoldersLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-white">
            <Suspense fallback={null}>
                <Sidebar />
            </Suspense>
            <div className="flex-1 flex flex-col overflow-hidden">
                <Suspense fallback={null}>
                    <TopBar />
                </Suspense>
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F7F8FA] p-6">
                    <Suspense fallback={null}>
                        {children}
                    </Suspense>
                </main>
            </div>
        </div>
    );
}
