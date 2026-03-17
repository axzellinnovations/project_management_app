'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { getUserFromToken, User } from '@/lib/auth';
import { useParams, usePathname } from 'next/navigation';
import api from '@/lib/axios';

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
    const [user, setUser] = useState<User | null>(null);
    const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

    const resolvedProfilePicUrl = useMemo(() => {
        if (!profilePicUrl) return '';
        if (profilePicUrl.startsWith('http://') || profilePicUrl.startsWith('https://')) {
            return profilePicUrl;
        }
        return `${API_BASE_URL}${profilePicUrl}`;
    }, [profilePicUrl]);

    useEffect(() => {
        const storedName = localStorage.getItem('currentProjectName');
        if (storedName) {
            setProjectName(storedName);
        }

        const storedId = localStorage.getItem('currentProjectId');
        if (storedId) {
            setProjectId(storedId);
            const fetchProjectStatus = async () => {
                try {
                    const response = await api.get(`/api/projects/${storedId}`);
                    setIsFavorite(response.data.isFavorite);
                } catch (e) {}
            };
            fetchProjectStatus();
        }
        
        const userData = getUserFromToken();
        setUser(userData);

        if (userData?.email) {
            const loadProfilePic = async () => {
                try {
                    const response = await api.get('/api/auth/users');
                    const currentUser = response.data.find(
                        (u: any) => u.email.toLowerCase() === userData.email.toLowerCase()
                    );
                    if (currentUser?.profilePicUrl) {
                        setProfilePicUrl(currentUser.profilePicUrl);
                    }
                } catch (error) {
                    // Silently fail
                }
            };
            void loadProfilePic();
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
                            
                            {/* Favorite Toggle Icon */}
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={async () => {
                                    if (!projectId) return;
                                    const nextState = !isFavorite;
                                    setIsFavorite(nextState);
                                    try {
                                        await api.post(`/api/projects/${projectId}/favorite`);
                                    } catch (e) {
                                        setIsFavorite(!nextState);
                                    }
                                }}
                                className="ml-1"
                            >
                                <motion.svg
                                    animate={{ 
                                        fill: isFavorite ? "#FFD700" : "transparent",
                                        stroke: isFavorite ? "#FFD700" : "#6A7282",
                                        scale: isFavorite ? [1, 1.3, 1] : 1
                                    }}
                                    transition={{ duration: 0.3 }}
                                    width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                >
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </motion.svg>
                            </motion.button>

                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1">
                                <path d="M4 6L8 10L12 6" stroke="#1D293D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                        {resolvedProfilePicUrl ? (
                            <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-white">
                                <Image
                                    src={resolvedProfilePicUrl}
                                    alt="Profile"
                                    width={32}
                                    height={32}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-[12px] font-bold">
                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
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
