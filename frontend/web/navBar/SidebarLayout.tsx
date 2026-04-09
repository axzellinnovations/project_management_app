'use client';

import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import TopBar from './TopBar';
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isChatRoute = pathname?.includes('/chat');

    return (
        <div className="flex h-screen overflow-hidden bg-cu-bg">
            <Sidebar />
            <div
                className="flex flex-col flex-1 min-w-0 overflow-hidden"
                style={{ transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)' }}
            >
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden main-content-area">
                    <Suspense fallback={null}>
                        <TopBar />
                    </Suspense>
                    <div className={`flex-1 w-full ${isChatRoute ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                        {children}
                    </div>
                </div>
            </div>
            <BottomNav />
        </div>
    );
}
