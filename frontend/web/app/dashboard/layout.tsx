"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../nav/Sidebar";
import TopBar from "../nav/TopBar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.replace("/login");
            return;
        }

        const handleStorage = (event: StorageEvent) => {
            if (event.key === "token" && !event.newValue) {
                router.replace("/login");
            }
        };

        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [router]);

    return (
        <div className="flex h-screen bg-white">
            {/* Sidebar */}
            <Sidebar />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* TopBar */}
                <TopBar />

                {/* Main Content Area */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-white p-8">
                    {children}
                </main>
            </div>
        </div>

    );
}
