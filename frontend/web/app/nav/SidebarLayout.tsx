'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('planora:sidebar:collapsed') === 'true';
    });

    const handleCollapsedChange = useCallback(() => {
        setCollapsed(localStorage.getItem('planora:sidebar:collapsed') === 'true');
    }, []);

    useEffect(() => {
        window.addEventListener('planora:sidebar:collapsed', handleCollapsedChange);
        return () => window.removeEventListener('planora:sidebar:collapsed', handleCollapsedChange);
    }, [handleCollapsedChange]);

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
