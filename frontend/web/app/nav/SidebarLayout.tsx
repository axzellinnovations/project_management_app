'use client';

import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div
                className="flex flex-col flex-1 min-w-0 overflow-hidden"
                style={{ transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)' }}
            >
                {/* Main content — extra bottom padding on mobile for the BottomNav */}
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden main-content-area">
                    {children}
                </div>
            </div>
            {/* Persistent mobile bottom navigation */}
            <BottomNav />
        </div>
    );
}
