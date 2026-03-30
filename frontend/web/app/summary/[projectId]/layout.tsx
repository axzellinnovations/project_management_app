'use client';

import Sidebar from "../../nav/Sidebar";
import TopBar from "../../nav/TopBar";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/axios";

export default function SummaryLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const projectId = params?.projectId as string | undefined;

    useEffect(() => {
        if (!projectId) return;

        // Keep localStorage in sync so TopBar, Sidebar, Folders etc. still work
        localStorage.setItem('currentProjectId', projectId);

        const record = async () => {
            try {
                await api.post(`/api/projects/${projectId}/access`);
                // Dispatch AFTER the await — DB write is committed
                window.dispatchEvent(new CustomEvent('planora:project-accessed'));
            } catch {
                // silently ignore 403 (non-member or auth error)
            }
        };

        void record();
    }, [projectId]);

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <TopBar />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
