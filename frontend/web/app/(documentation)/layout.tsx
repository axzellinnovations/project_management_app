import { Suspense } from 'react';
import SidebarLayout from '../nav/SidebarLayout';
import TopBar from '../nav/TopBar';

export default function DocumentationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarLayout>
            <Suspense fallback={<div className="h-[74px] bg-[#F1F6F9]" />}>
                <TopBar />
            </Suspense>
            {/* Main Content Area */}
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
                {children}
            </main>
        </SidebarLayout>
    );
}
