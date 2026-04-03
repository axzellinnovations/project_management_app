'use client';

import Sidebar from '@/components/layout/Sidebar';
import BottomNav from './BottomNav';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden bg-cu-bg">
            <Sidebar />
            <div
                className="flex flex-col flex-1 min-w-0 overflow-hidden"
                style={{ transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)' }}
            >
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden main-content-area">
                    {children}
                </div>
            </div>
            <BottomNav />
        </div>
    );
}
