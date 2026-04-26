'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import agileConfig from '../projectSetup/ifAgile';
import kanbanConfig from '../projectSetup/ifKanban';
import ProjectSetupPage from '../projectSetup/ProjectSetupPage';

const configByMethod = {
    ifAgile: agileConfig,
    ifKanban: kanbanConfig
} as const;

export default function ProjectMethodPage() {
    const params = useParams<{ method?: string }>();
    const router = useRouter();
    const method = params?.method;

    const selectedConfig = method ? configByMethod[method as keyof typeof configByMethod] : undefined;

    useEffect(() => {
        if (!selectedConfig) {
            router.replace('/createProject');
        }
    }, [router, selectedConfig]);

    if (!selectedConfig) {
        return null;
    }

    return <ProjectSetupPage {...selectedConfig} />;
}
