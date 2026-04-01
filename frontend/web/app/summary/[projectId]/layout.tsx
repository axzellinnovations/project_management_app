'use client';

import { Suspense } from 'react';
import SidebarLayout from "../../nav/SidebarLayout";
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
        <SidebarLayout>
            <Suspense fallback={null}>
                <TopBar />
            </Suspense>
            <main className="flex-1 overflow-y-auto bg-[#F7F8FA]">
                {children}
            </main>
        </SidebarLayout>
    );
}
