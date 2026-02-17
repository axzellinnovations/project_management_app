import Sidebar from "../nav/Sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-white">
            {/* Sidebar */}
            <Sidebar />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Main Content Area */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-white p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
