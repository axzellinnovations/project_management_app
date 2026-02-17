'use client';

import Link from 'next/link';



export default function CreateProjectPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#EFF6FF] via-[#FFFFFF] to-[#FAF5FF] flex flex-col items-center py-20 px-4">
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="font-outfit font-bold text-[36px] leading-[40px] text-[#101828] mb-3">
                    Choose Your Project Type
                </h1>
                <p className="font-inter text-[18px] leading-[28px] text-[#4A5565]">
                    Select the methodology that best fits your team&apos;s needs
                </p>
            </div>

            {/* Cards Container */}
            <div className="flex flex-col md:flex-row gap-8 mb-12">
                {/* Agile Scrum Card */}
                <div className="w-[496px] bg-white rounded-[16px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] p-8 relative flex flex-col h-[509px] box-border">
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-[#DBEAFE] rounded-[14px] flex items-center justify-center">
                            {/* Agile Icon Placeholder */}
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D56D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2v20M2 12h20" />
                                <circle cx="12" cy="12" r="10" />
                            </svg>
                        </div>
                        <div className="bg-[#DBEAFE] px-3 py-1 rounded-full">
                            <span className="font-inter font-medium text-[14px] text-[#1D56D5]">Popular</span>
                        </div>
                    </div>

                    <h3 className="font-outfit font-bold text-[24px] leading-[32px] text-[#101828] mb-2">
                        Agile Scrum
                    </h3>
                    <p className="font-inter text-[16px] leading-[26px] text-[#4A5565] mb-8">
                        Perfect for teams that work in sprints with iterative feedback and strictly planned workflows.
                    </p>

                    <div className="flex flex-col gap-3 mb-auto">
                        <FeatureItem text="Sprint planning and backlog management" />
                        <FeatureItem text="Story points and velocity tracking" />
                        <FeatureItem text="Sprint retrospectives and reviews" />
                        <FeatureItem text="Team collaboration features" />
                    </div>

                    <Link href="/createProject/ifAgile" className="w-full h-[48px] bg-[#1D56D5] rounded-[10px] text-white font-inter font-medium text-[16px] mt-8 hover:bg-blue-700 transition-colors flex items-center justify-center">
                        Choose Scrum
                    </Link>
                </div>

                {/* Kanban Card */}
                <div className="w-[496px] bg-white rounded-[16px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] p-8 relative flex flex-col h-[509px] box-border">
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-[#F3E8FF] rounded-[14px] flex items-center justify-center">
                            {/* Kanban Icon Placeholder */}
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#AD46FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <path d="M9 3v18" />
                                <path d="M15 3v18" />
                            </svg>
                        </div>
                        <div className="bg-[#F3E8FF] px-3 py-1 rounded-full">
                            <span className="font-inter font-medium text-[14px] text-[#9810FA]">Flexible</span>
                        </div>
                    </div>

                    <h3 className="font-outfit font-bold text-[24px] leading-[32px] text-[#101828] mb-2">
                        Kanban
                    </h3>
                    <p className="font-inter text-[16px] leading-[26px] text-[#4A5565] mb-8">
                        Great for continuous delivery with visual implementation and flexible prioritization.
                    </p>

                    <div className="flex flex-col gap-3 mb-auto">
                        <FeatureItem text="Visual board with customizable columns" />
                        <FeatureItem text="Work-in-progress (WIP) limits" />
                        <FeatureItem text="Continuous flow optimization" />
                        <FeatureItem text="Real-time progress tracking" />
                    </div>

                    <button className="w-full h-[48px] bg-[#AD46FF] rounded-[10px] text-white font-inter font-medium text-[16px] mt-8 hover:bg-purple-600 transition-colors">
                        Choose Kanban
                    </button>
                </div>
            </div>

            {/* Footer Info */}
            <div className="w-full max-w-[1024px] bg-[#EFF6FF] border border-[#DBEAFE] rounded-[14px] p-6 flex items-start gap-4">
                <div className="w-10 h-10 bg-[#DBEAFE] rounded-[10px] flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D56D5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                </div>
                <div>
                    <h4 className="font-inter font-medium text-[16px] text-[#101828] mb-1">
                        Don&apos;t worry, you can always change this later
                    </h4>
                    <p className="font-inter text-[14px] text-[#4A5565]">
                        You can switch between Scrum and Kanban at any time from project settings.
                    </p>
                </div>
            </div>
            <div className="mt-8 text-center text-[#4A5565] font-inter text-[14px]">
                © 2025 Planora. All rights reserved.
            </div>
        </div>
    );
}

function FeatureItem({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="8.33333" stroke="#00C950" strokeWidth="1.66667" />
                    <path d="M7 10L9 12L13 8" stroke="#00C950" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
            <span className="font-inter text-[14px] text-[#364153]">{text}</span>
        </div>
    );
}
