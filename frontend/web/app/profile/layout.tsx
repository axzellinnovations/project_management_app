'use client';

import React from 'react';
import SidebarLayout from '@/navBar/SidebarLayout';

export default function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarLayout>
            <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#F7F8FA]">
                {children}
            </main>
        </SidebarLayout>
    );
}

