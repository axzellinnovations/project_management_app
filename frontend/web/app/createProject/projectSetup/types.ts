import type { ReactNode } from 'react';

export type ProjectType = 'AGILE' | 'KANBAN';

export type ProjectSetupConfig = {
    projectType: ProjectType;
    methodologyName: string;
    projectNamePlaceholder: string;
    projectKeyPlaceholder: string;
    methodologyIcon: ReactNode;
};