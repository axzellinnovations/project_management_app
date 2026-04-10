'use client';

import { Suspense } from 'react';
import DmsWorkspace from '@/app/folders/components/DmsWorkspace';
import { ViewMode } from '@/app/folders/components/types';

interface FoldersPageProps {
    mode: ViewMode;
}

export default function FoldersPage({ mode }: FoldersPageProps) {
    return (
        <Suspense fallback={null}>
            <DmsWorkspace mode={mode} />
        </Suspense>
    );
}
