'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function FoldersRootContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const projectId = searchParams.get('projectId');
        if (projectId) {
            // replace() instead of push() so navigating Back from view-all doesn't bounce here again
            router.replace(`/folders/view-all?projectId=${projectId}`);
            return;
        }

        if (typeof window !== 'undefined') {
            // localStorage fallback restores the project context when the URL has no projectId
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

export default function FoldersRootPage() {
    return (
        <Suspense fallback={null}>
            <FoldersRootContent />
        </Suspense>
    );
}
