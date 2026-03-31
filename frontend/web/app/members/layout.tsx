'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../nav/Sidebar';
import TopBar from '../nav/TopBar';
import api from '@/lib/axios';

export default function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const projectId =
    (typeof params?.projectId === 'string' && params.projectId) ||
    (typeof params?.id === 'string' && params.id) ||
    undefined;

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
    <div className="flex h-screen bg-[#F7F8FA]">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 min-h-0 overflow-y-auto bg-[#F7F8FA]">
          {children}
        </main>
      </div>
    </div>
  );
}
