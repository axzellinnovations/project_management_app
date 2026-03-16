'use client';

import { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { getUserFromToken, User } from '@/lib/auth';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import api from '@/lib/axios';

const baseTabs = [
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

const subscribeToBrowserStorage = (onStoreChange: () => void) => {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const handler = () => onStoreChange();
    window.addEventListener('storage', handler);
    window.addEventListener('focus', handler);

    return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('focus', handler);
    };
};

export default function TopBar() {
    const projectName = useSyncExternalStore(
        subscribeToBrowserStorage,
        () => localStorage.getItem('currentProjectName') || 'Project Name',
        () => 'Project Name'
    );
    const storedProjectId = useSyncExternalStore(
        subscribeToBrowserStorage,
        () => localStorage.getItem('currentProjectId'),
        () => null
    );
    const token = useSyncExternalStore<string | null>(
        subscribeToBrowserStorage,
        () => localStorage.getItem('token'),
        () => null
    );
        const user = useMemo<User | null>(() => {
            if (!token) return null;
            return getUserFromToken();
        }, [token]);

    const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
    const params = useParams();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

    const resolvedProfilePicUrl = useMemo(() => {
        if (!profilePicUrl) return '';
        if (profilePicUrl.startsWith('http://') || profilePicUrl.startsWith('https://')) {
            return profilePicUrl;
        }
        return `${API_BASE_URL}${profilePicUrl}`;
    }, [profilePicUrl, API_BASE_URL]);

    const projectId = useMemo(() => {
        const queryProjectId = searchParams.get('projectId');
        const routeProjectId = typeof params?.id === 'string' ? params.id : null;

        return queryProjectId || routeProjectId || storedProjectId;
    }, [params, searchParams, storedProjectId]);

    const activeTab = useMemo(() => {
        if (pathname.startsWith('/kanban') || pathname.startsWith('/sprint-board')) {
            return 'board';
        }

        if (pathname.startsWith('/sprint-backlog')) {
            return 'backlog';
        }

        if (pathname.startsWith('/project/') && pathname.includes('/chat')) {
            return 'chats';
        }

        if (pathname.startsWith('/pages')) {
            return 'pages';
        }

        if (pathname.startsWith('/spaces') || pathname.startsWith('/folders')) {
            return 'list';
        }

        if (pathname.startsWith('/summary')) {
            return 'summary';
        }

        return 'summary';
    }, [pathname]);

    useEffect(() => {
        if (projectId && localStorage.getItem('currentProjectId') !== projectId) {
            localStorage.setItem('currentProjectId', projectId);
        }
    }, [projectId]);

    useEffect(() => {
        if (user?.email) {
            const loadProfilePic = async () => {
                try {
                    const response = await api.get('/api/auth/users');
                    interface UserSummary {
                        email: string;
                        profilePicUrl?: string;
                    }

                    const currentUser = response.data.find(
                        (u: UserSummary) => u.email.toLowerCase() === user.email.toLowerCase()
                    );
                    if (currentUser?.profilePicUrl) {
                        setProfilePicUrl(currentUser.profilePicUrl);
                    }
                } catch {
                    // Silently fail
                }
            };
            void loadProfilePic();
        }
    }, [user]);

    const withProjectId = (basePath: string) => {
        if (!projectId) return basePath;
        return `${basePath}?projectId=${projectId}`;
    };

    const getTabHref = (tabId: string) => {
        switch (tabId) {
            case 'summary':
                return withProjectId('/summary');
            case 'timeline':
                return withProjectId('/summary');
            case 'backlog':
                return '/sprint-backlog';
            case 'board':
                return withProjectId('/kanban');
            case 'calendar':
                return withProjectId('/summary');
            case 'chats':
                return projectId ? `/project/${projectId}/chat` : '/summary';
            case 'members':
                return withProjectId('/summary');
            case 'pages':
                return withProjectId('/pages');
            case 'list':
                return '/spaces';
            default:
                return withProjectId('/summary');
        }
    };

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
                </div>
            </div>

            {/* Bottom Nav Section (45px) */}
            <div className="h-[45px] bg-white border-b border-[#E3E8EF] px-8 flex items-end gap-8">
                {baseTabs.map((tab) => (
                    <Link
                        key={tab.id}
                        href={getTabHref(tab.id)}
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
                    </Link>
                ))}
            </div>
        </div>
    );
}
