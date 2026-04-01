'use client';

import { Suspense } from 'react';
import SidebarLayout from '../nav/SidebarLayout';
import TopBar from '../nav/TopBar';

export default function SpacesLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarLayout>
            <Suspense fallback={null}>
                <TopBar />
            </Suspense>
            <main className="flex-1 overflow-y-auto bg-[#F7F8FA]">
                {children}
            </main>
        </SidebarLayout>
    );
}
