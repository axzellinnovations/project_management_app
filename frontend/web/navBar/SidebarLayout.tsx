'use client';

import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { Suspense, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import CommandPalette from '@/components/ui/CommandPalette';
import { useNavigation } from '@/lib/navigation-context';

interface SidebarLayoutProps {
    children: React.ReactNode;
    showTopBar?: boolean;
}

export default function SidebarLayout({ children, showTopBar = true }: SidebarLayoutProps) {
    const pathname = usePathname();
    const { isSidebarOpen } = useNavigation();
    const isChatRoute = pathname?.includes('/chat');
    const isSprintBacklogRoute = pathname?.includes('/sprint-backlog');
    
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [pathname]);

    return (
        <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-cu-bg relative overscroll-none">
            <Sidebar />
            <div
                className={`flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden transition-[filter] duration-300 ease-out ${isSidebarOpen ? 'blur-[3px] pointer-events-none md:blur-0 md:pointer-events-auto' : 'blur-0 pointer-events-auto'}`}
                style={{ transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)' }}
            >
                <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden main-content-area">
                    {showTopBar && (
                        <div className="shrink-0 transition-opacity duration-200 ease-out">
                            <Suspense fallback={null}>
                                <TopBar />
                            </Suspense>
                        </div>
                    )}
                    <div ref={scrollRef} className={`flex-1 w-full flex flex-col min-h-0 relative ${isChatRoute || isSprintBacklogRoute ? 'overflow-hidden' : 'overflow-y-auto touch-pan-y'}`}>
                        {children}
                    </div>
                </div>
            </div>
            <CommandPalette />
        </div>
    );
}
