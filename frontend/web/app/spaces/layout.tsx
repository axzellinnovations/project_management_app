'use client';

import React from 'react';
import SidebarLayout from '@/navBar/SidebarLayout';

export default function SpacesLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarLayout>
            <main className="flex-1 flex flex-col min-h-full bg-[#F7F8FA]">
                {children}
            </main>
        </SidebarLayout>
    );
}
