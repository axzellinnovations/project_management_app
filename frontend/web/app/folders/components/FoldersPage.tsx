'use client';

import DmsWorkspace from '@/app/folders/components/DmsWorkspace';
import { ViewMode } from '@/app/folders/components/types';

interface FoldersPageProps {
    mode: ViewMode;
}

export default function FoldersPage({ mode }: FoldersPageProps) {
    return <DmsWorkspace mode={mode} />;
}
