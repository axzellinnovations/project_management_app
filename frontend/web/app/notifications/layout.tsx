'use client';

import React from 'react';
import SidebarLayout from '@/navBar/SidebarLayout';

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarLayout>
      <main className="flex-1 overflow-y-auto bg-[#F7F8FA]">
        {children}
      </main>
    </SidebarLayout>
  );
}
