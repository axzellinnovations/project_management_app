'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'backlog', label: 'Backlog' },
    { id: 'board', label: 'Board' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'chats', label: 'Chats' },
    { id: 'members', label: 'Members' },
    { id: 'pages', label: 'Pages' },
    { id: 'list', label: 'List' },
];

export default function TopBar() {
    const [activeTab, setActiveTab] = useState('summary');
    const [projectName, setProjectName] = useState('Project Name');

    useEffect(() => {
        const storedName = localStorage.getItem('currentProjectName');
        if (storedName) {
            setProjectName(storedName);
        }
    }, []);

    return (
        <div className="w-full h-[119px] relative flex flex-col">
            {/* Top Header Section (74px) */}
            <div className="flex-1 bg-[#F1F6F9] px-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="w-10 h-10 bg-[#00D3F3] rounded-lg flex items-center justify-center shrink-0">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 2.5L16.6667 6.66667V13.3333L10 17.5L3.33333 13.3333V6.66667L10 2.5Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    <div className="flex flex-col">
                        <span className="font-arimo text-[12px] uppercase tracking-[0.3px] text-[#6A7282] mb-0.5">Projects</span>
                        <div className="flex items-center gap-2">
                            <span className="font-arimo text-[19px] text-[#1D293D] whitespace-nowrap">{projectName}</span>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 6L8 10L12 6" stroke="#1D293D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Right Side Actions (Placeholder) */}
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white"></div>
                        <div className="w-8 h-8 rounded-full bg-purple-500 border-2 border-white"></div>
                        <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] text-gray-600 font-bold">+2</div>
                    </div>
                    <button className="bg-[#0052CC] text-white px-3 py-1.5 rounded-md font-arimo text-[13px] font-semibold">Share</button>
                </div>
            </div>

            {/* Bottom Nav Section (45px) */}
            <div className="h-[45px] bg-white border-b border-[#E3E8EF] px-8 flex items-end gap-8">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="relative pb-3 px-1"
                    >
                        <span
                            className={`font-inter text-[14px] leading-[20px] transition-colors duration-200 ${activeTab === tab.id
                                ? 'text-[#101828] font-semibold'
                                : 'text-[#667085] font-medium hover:text-[#101828]'
                                }`}
                        >
                            {tab.label}
                        </span>
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#155DFC] rounded-t-[2px]"
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
