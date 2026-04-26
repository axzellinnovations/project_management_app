'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

// Data model for each project-type selection card.
type ProjectTypeCard = {
    name: 'Agile' | 'Kanban';
    href: string;
    description: string;
    cta: string;
    icon: ReactNode;
};

const pageContainerClass =
    'min-h-screen relative flex flex-col items-center justify-center p-4 overflow-hidden bg-[#F5F5F7] selection:bg-[#1D56D5] selection:text-white';

const cardsGridClass = 'flex flex-col md:flex-row gap-6 w-full max-w-[800px]';

const cardClass =
    'flex-1 bg-white/60 backdrop-blur-2xl rounded-[24px] shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/50 hover:bg-white/80 hover:shadow-[0_12px_40px_0_rgba(31,38,135,0.1)] transition-all p-6 flex flex-col items-center text-center cursor-pointer group';

const cardIconWrapperClass =
    'w-16 h-16 bg-white/70 backdrop-blur-md rounded-full shadow-sm flex items-center justify-center mb-4 transition-all group-hover:bg-[#1D56D5] group-hover:shadow-[0_4px_16px_0_rgba(29,86,213,0.3)]';

const cardIconClass =
    'stroke-[#1D56D5] group-hover:stroke-white transition-colors duration-300';

const cardTitleClass = 'font-outfit font-bold text-[22px] text-[#1D1D1F] mb-2';

const cardDescriptionClass =
    'font-inter text-[14px] leading-[22px] text-[#86868B] mb-6 flex-grow';

const cardCtaClass =
    'text-[#1D56D5] font-medium font-inter group-hover:text-[#1642B5] transition-colors relative text-[14px]';

const cardUnderlineClass =
    'block h-0.5 bg-[#1D56D5] absolute -bottom-1 left-0 w-0 group-hover:w-full transition-all duration-300';

const projectTypeCards: ProjectTypeCard[] = [
    {
        name: 'Agile',
        href: '/createProject/ifAgile',
        description:
            'Best for teams using Scrum or Sprints. Plan, track, and manage iterative work efficiently.',
        cta: 'Create Agile Project',
        icon: (
            <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                className={cardIconClass}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
        )
    },
    {
        name: 'Kanban',
        href: '/createProject/ifKanban',
        description:
            'Best for continuous flow. Visualize your work, limit work in progress, and maximize efficiency.',
        cta: 'Create Kanban Project',
        icon: (
            <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                className={cardIconClass}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
        )
    }
];

// Reusable card UI for a single project methodology option.
function ProjectCard({ name, href, description, cta, icon }: ProjectTypeCard) {
    return (
        <Link href={href} className={cardClass}>
            <div className={cardIconWrapperClass}>{icon}</div>
            <h2 className={cardTitleClass}>{name}</h2>
            <p className={cardDescriptionClass}>{description}</p>
            <div className={cardCtaClass}>
                {cta}
                <span className={cardUnderlineClass}></span>
            </div>
        </Link>
    );
}

// Decorative blurred orbs rendered behind the main content.
function BackgroundOrbs() {
    return (
        <>
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#3B82F6]/30 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#8B5CF6]/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-[#10B981]/20 rounded-full blur-[100px] pointer-events-none" />
        </>
    );
}

export default function CreateProjectSelectionPage() {
    return (
        // Main page container for project type selection.
        <div className={pageContainerClass}>
            <BackgroundOrbs />

            <div className="relative z-10 w-full flex flex-col items-center">
                {/* Page heading and helper text. */}
                <div className="text-center mb-6">
                    <h1 className="font-outfit font-bold text-[32px] leading-[40px] text-[#1D1D1F] mb-2 tracking-tight">
                        Select Project Type
                    </h1>
                    <p className="font-inter text-[16px] leading-[24px] text-[#86868B] max-w-[482px] mx-auto">
                        Choose the methodology that best fits your team&apos;s workflow.
                    </p>
                </div>

                {/* Project methodology choices. */}
                <div className={cardsGridClass}>
                    {projectTypeCards.map((card) => (
                        <ProjectCard key={card.name} {...card} />
                    ))}
                </div>

                {/* Shortcut to return to dashboard without creating a project. */}
                <div className="mt-8">
                    <Link href="/dashboard" className="text-[#86868B] hover:text-[#1D1D1F] font-inter font-medium transition-colors text-[14px]">
                        ← Back to Dashboard
                    </Link>
                </div>
            </div>

            {/* Static footer note pinned near the bottom edge. */}
            <div className="absolute bottom-6 left-0 right-0 text-center text-[#86868B] font-inter text-[12px] z-10">
                © 2025 Planora. All rights reserved.
            </div>
        </div>
    );
}