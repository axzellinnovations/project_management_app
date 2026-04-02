'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface NavigationContextType {
    isSidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();
    const prevPathnameRef = useRef(pathname);

    const toggleSidebar = () => setSidebarOpen((prev) => !prev);

    // Automatically close sidebar on navigation (mobile).
    // State is reset during render (not inside an effect) to avoid cascading renders.
    // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
    if (prevPathnameRef.current !== pathname) {
        prevPathnameRef.current = pathname;
        if (isSidebarOpen) {
            setSidebarOpen(false);
        }
    }

    // Dispatch event so the Sidebar component's own collapsed state also closes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('planora:sidebar:close'));
        }
    }, [pathname]);

    return (
        <NavigationContext.Provider value={{ isSidebarOpen, setSidebarOpen, toggleSidebar }}>
            {children}
        </NavigationContext.Provider>
    );
}

export function useNavigation() {
    const context = useContext(NavigationContext);
    if (context === undefined) {
        throw new Error('useNavigation must be used within a NavigationProvider');
    }
    return context;
}
