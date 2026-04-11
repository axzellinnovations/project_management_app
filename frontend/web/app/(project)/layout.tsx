'use client';

import { useEffect, useRef } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import SidebarLayout from '@/navBar/SidebarLayout';
import api from '@/lib/axios';
import { getValidToken } from '@/lib/auth';

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
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const isChatRoute = pathname?.includes('/chat');
  const isInboxRoute = pathname?.startsWith('/inbox');

  // Try to resolve projectId from path params or query params
  const projectId = (params?.projectId || params?.id || searchParams.get('projectId')) as string | undefined;

  // Guard: only run syncProjectContext once per projectId
  const syncedProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    const token = getValidToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    if (!projectId) return;
    // Skip if we already synced this project
    if (syncedProjectIdRef.current === projectId) return;
    syncedProjectIdRef.current = projectId;

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
      <main
        className={
          isChatRoute
            ? 'h-full min-h-0 flex flex-col overflow-hidden'
            : isInboxRoute
              ? 'min-h-full'
              : 'flex-1 min-h-0 overflow-hidden'
        }
      >
        {children}
      </main>
    </SidebarLayout>
  );
}
