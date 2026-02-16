export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="w-full font-sans p-6 md:p-8">
            {children}
        </div>
    );
}
