import SidebarLayout from '../nav/SidebarLayout';
import { Suspense } from 'react';
import TopBar from '../nav/TopBar';

export default function TimelineLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarLayout>
            <Suspense fallback={<div className="h-[119px] bg-[#F7F8FA]" />}>
                <TopBar />
            </Suspense>
            <main className="flex-1 min-h-0 overflow-y-auto bg-[#F7F8FA]">
                {children}
            </main>
        </SidebarLayout>
    );
}
