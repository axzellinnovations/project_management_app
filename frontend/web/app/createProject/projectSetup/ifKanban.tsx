import type { ProjectSetupConfig } from './ProjectSetupPage';

const kanbanConfig: ProjectSetupConfig = {
    projectType: 'KANBAN',
    methodologyName: 'Kanban Board',
    projectNamePlaceholder: 'e.g., Support Kanban',
    projectKeyPlaceholder: 'e.g., SUP',
    methodologyIcon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 22h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2Z" />
            <path d="M14 2v20" />
            <path d="M8 2v20" />
        </svg>
    )
};

export default kanbanConfig;
