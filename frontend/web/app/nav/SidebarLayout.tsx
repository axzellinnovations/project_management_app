'use client';

import Sidebar from './Sidebar';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div
                className="flex flex-col flex-1 min-w-0 overflow-hidden"
                style={{ transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)' }}
            >
                {children}
            </div>
        </div>
    );
}
