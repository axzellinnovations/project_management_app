'use client';

import { Suspense } from 'react';
import DmsWorkspace from '@/app/folders/components/DmsWorkspace';
import { ViewMode } from '@/app/folders/components/types';

interface FoldersPageProps {
    mode: ViewMode;
}

export default function FoldersPage({ mode }: FoldersPageProps) {
    return (
        // Suspense boundary is required because DmsWorkspace calls useSearchParams inside useDmsWorkspace,
        // which suspends during SSR — without this boundary the whole route throws on the server.
        <Suspense fallback={null}>
            <DmsWorkspace mode={mode} />
        </Suspense>
    );
}
