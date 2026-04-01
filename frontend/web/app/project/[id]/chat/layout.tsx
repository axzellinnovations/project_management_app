'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SidebarLayout from '../../../nav/SidebarLayout';
import TopBar from '../../../nav/TopBar';
import api from '@/lib/axios';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string | undefined;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    if (!projectId) return;

    localStorage.setItem('currentProjectId', projectId);

    const syncProjectContext = async () => {
      try {
        const projectRes = await api.get(`/api/projects/${projectId}`);
        if (projectRes?.data?.name) {
          localStorage.setItem('currentProjectName', projectRes.data.name);
        }
      } catch {
        // ignore project context fetch failures
      }

      try {
        await api.post(`/api/projects/${projectId}/access`);
        window.dispatchEvent(new CustomEvent('planora:project-accessed'));
      } catch {
        // ignore access record failures
      }
    };

    void syncProjectContext();
  }, [projectId, router]);

  return (
    <SidebarLayout>
      <Suspense fallback={<div className="h-[74px] bg-[#F1F6F9]" />}>
        <TopBar />
      </Suspense>
      <main className="flex-1 min-h-0 overflow-hidden bg-[#F7F8FA]">
        {children}
      </main>
    </SidebarLayout>
  );
}
