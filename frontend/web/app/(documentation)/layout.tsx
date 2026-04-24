import SidebarLayout from '@/navBar/SidebarLayout';

export default function DocumentationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarLayout>
            {/* overflow-x-hidden prevents horizontal scroll from any wide content (tables, code blocks) while keeping vertical scroll intact */}
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
                {children}
            </main>
        </SidebarLayout>
    );
}
