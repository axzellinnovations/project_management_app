'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';

function normalizeProjectId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

export default function MembersLegacyRoutePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuery = normalizeProjectId(searchParams.get('projectId'));
  const fromStorage =
    typeof window !== 'undefined'
      ? normalizeProjectId(window.localStorage.getItem('currentProjectId'))
      : null;
  const resolvedProjectId = fromQuery || fromStorage;

  useEffect(() => {
    if (!resolvedProjectId) return;
    router.replace(`/members/${resolvedProjectId}`);
  }, [resolvedProjectId, router]);

  if (resolvedProjectId) {
    return (
      <div className="mobile-page-padding max-w-5xl mx-auto py-8 text-sm text-slate-500">
        Opening members...
      </div>
    );
  }

  return (
    <div className="mobile-page-padding max-w-5xl mx-auto pb-[clamp(96px,12vh,128px)] sm:pb-10">
      <EmptyState
        icon={<Users size={20} />}
        title="Select a project first"
        subtitle="Pick a project from the sidebar, then open members to manage access and roles."
        action={(
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-cu-primary px-4 text-sm font-semibold text-white hover:bg-cu-primary-dark"
          >
            Open Dashboard
          </button>
        )}
      />
    </div>
  );
}
