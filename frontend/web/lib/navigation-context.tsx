'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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

    const toggleSidebar = () => setSidebarOpen((prev) => !prev);

    // Automatically close sidebar on navigation (mobile)
    useEffect(() => {
        setSidebarOpen(false);
        // Dispatch event so the Sidebar component's own collapsed state also closes
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
