'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import SidebarLayout from '@/navBar/SidebarLayout';
import api from '@/lib/axios';

/**
 * Unified Project Layout
 * 
 * Provides a shared Sidebar + TopBar shell for all project tools:
 * - summary/[projectId]
 * - project/[id]/chat
 * - backlog
 * - timeline
 * - calendar
 * - members
 * - pages
 * 
 * This ensures that navigating between project tabs does not re-mount the SidebarLayout,
 * providing a smooth SPA feel.
 */
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // Try to resolve projectId from path params or query params
  const projectId = (params?.projectId || params?.id || searchParams.get('projectId')) as string | undefined;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    if (!projectId) return;

    // Keep localStorage in sync so TopBar, Sidebar, etc. work correctly
    localStorage.setItem('currentProjectId', projectId);

    const syncProjectContext = async () => {
      try {
        const projectRes = await api.get(`/api/projects/${projectId}`);
        if (projectRes?.data?.name) {
          localStorage.setItem('currentProjectName', projectRes.data.name);
          // Update project type for TopBar logic
          if (projectRes.data.type) {
            localStorage.setItem('currentProjectType', projectRes.data.type);
          }
        }
      } catch {
        // ignore fetch failures
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
      <main className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>
    </SidebarLayout>
  );
}
