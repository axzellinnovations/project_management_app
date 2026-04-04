import { Suspense } from 'react';
import SidebarLayout from '../nav/SidebarLayout';

export default function DocumentationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarLayout>
            {/* Main Content Area */}
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
                {children}
            </main>
        </SidebarLayout>
    );
}
