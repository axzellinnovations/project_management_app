'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function FoldersRootPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const projectId = searchParams.get('projectId');
        if (projectId) {
            router.replace(`/folders/view-all?projectId=${projectId}`);
            return;
        }

        if (typeof window !== 'undefined') {
            const storedProjectId = localStorage.getItem('currentProjectId');
            if (storedProjectId) {
                router.replace(`/folders/view-all?projectId=${storedProjectId}`);
                return;
            }
        }

        router.replace('/folders/view-all');
    }, [router, searchParams]);

    return null;
}
