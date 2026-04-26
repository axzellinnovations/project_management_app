import type { ProjectSetupConfig } from './types';

const agileConfig: ProjectSetupConfig = {
    projectType: 'AGILE',
    methodologyName: 'Agile Scrum',
    projectNamePlaceholder: 'e.g., E-Commerce Platform',
    projectKeyPlaceholder: 'e.g., ECOM',
    methodologyIcon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M2 12h20" />
            <circle cx="12" cy="12" r="10" />
        </svg>
    )
};

export default agileConfig;
