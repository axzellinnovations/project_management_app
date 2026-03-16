'use client';

import Sidebar from '@/app/nav/Sidebar';
import TopBar from '@/app/nav/TopBar';

export default function FoldersLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-white">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <TopBar />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F7F8FA] p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
