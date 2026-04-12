'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getUserFromToken, User } from '@/lib/auth';
import api from '@/lib/axios';
import RecentProjectCard from '../dashboard/components/RecentProjectCard';
import Link from 'next/link';
import { LayoutGrid, List } from 'lucide-react';

interface SpaceProject {
    id: number;
    name: string;
    projectKey?: string;
    isFavorite?: boolean;
    favoriteMarkedAt?: string;
    type?: 'AGILE' | 'KANBAN' | string;
    updatedAt?: string;
    lastAccessedAt?: string;
    memberCount?: number;
}

export default function SpacesPage() {
    const [projects, setProjects] = useState<SpaceProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const searchParams = useSearchParams();
    const [sortBy, setSortBy] = useState<'recent' | 'alphabetical' | 'favorites-first'>('recent');
    const [filterBy, setFilterBy] = useState<'all' | 'starred'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [user, setUser] = useState<User | null>(null);

    const setAndPersistView = (nextView: 'grid' | 'list') => {
        setViewMode(nextView);
        localStorage.setItem('spaces-view', nextView);
    };

    const fetchProjects = async () => {
        try {
            const response = await api.get('/api/projects');
            setProjects(response.data);
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        } finally {
            setLoading(false);
        }
    };

    // Set initial filter/sort from URL param
    useEffect(() => {
        const filter = searchParams.get('filter');
        if (filter === 'favorites') {
            setFilterBy('starred');
            setSortBy('favorites-first');
        } else if (filter === 'recent') {
            setFilterBy('all');
            setSortBy('recent');
        }
    }, [searchParams]);

    useEffect(() => {
        const savedView = localStorage.getItem('spaces-view') ?? 'grid';
        if (savedView === 'list' || savedView === 'grid') {
            setViewMode(savedView);
        }
    }, []);

    useEffect(() => {
        const userData = getUserFromToken();
        setUser(userData);
        void fetchProjects();
    }, []);

    const filteredAndSortedProjects = [...projects]
        .filter((project) => {
            const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (project.projectKey && project.projectKey.toLowerCase().includes(searchQuery.toLowerCase()));

            if (filterBy === 'starred') {
                return matchesSearch && Boolean(project.isFavorite);
            }
            return matchesSearch;
        })
        .sort((a, b) => {
            if (filterBy === 'starred') {
                const aStarredAt = a.favoriteMarkedAt ? new Date(a.favoriteMarkedAt).getTime() : 0;
                const bStarredAt = b.favoriteMarkedAt ? new Date(b.favoriteMarkedAt).getTime() : 0;
                if (aStarredAt !== bStarredAt) {
                    return bStarredAt - aStarredAt;
                }
                return a.name.localeCompare(b.name);
            }

            if (sortBy === 'favorites-first') {
                const aIsStarred = Boolean(a.isFavorite);
                const bIsStarred = Boolean(b.isFavorite);
                return (aIsStarred === bIsStarred)
                    ? a.name.localeCompare(b.name)
                    : bIsStarred ? 1 : -1;
            }

            if (sortBy === 'alphabetical') {
                return a.name.localeCompare(b.name);
            }

            const aRecent = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
            const bRecent = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
            return bRecent - aRecent;
        });

    return (
        <div className="mobile-page-padding max-w-[1200px] mx-auto pb-28 sm:pb-8">
            {/* Mobile Top Header */}
            <div className="flex items-center gap-3 py-4 md:hidden">
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('planora:sidebar:toggle'))}
                    className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors border border-slate-100"
                    aria-label="Toggle Sidebar"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <div className="font-outfit text-xl font-extrabold tracking-tight text-[#101828] flex items-center gap-2">
                    <span className="w-2 h-5 bg-blue-600 rounded-full"></span>
                    PLANORA
                </div>
            </div>
            {/* Header */}
            <div className="flex flex-col gap-1 mb-5">
                <div className="flex items-center gap-2 text-[13px] text-[#4A5565]">
                    <Link href="/dashboard" className="hover:text-[#0052CC]">Dashboard</Link>
                    <span>/</span>
                    <span className="font-medium text-[#101828]">Spaces</span>
                </div>
                <h1 className="font-outfit text-2xl sm:text-[32px] font-bold text-[#101828]">All spaces</h1>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-[#E5E7EB] mb-6">
                {/* Search */}
                <div className="relative w-full sm:w-[320px]">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#99A1AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search spaces"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 border border-[#D1D5DC] rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-arimo transition-all"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Filter tabs */}
                    <div className="flex items-center gap-1.5 bg-[#F4F5F7] p-1 rounded-xl overflow-x-auto no-scrollbar">
                        {(['all', 'starred'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setFilterBy(tab)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                                    filterBy === tab
                                        ? 'bg-white text-[#0052CC] shadow-sm'
                                        : 'text-[#4A5565] hover:text-[#101828]'
                                }`}
                            >
                                {tab === 'all' ? 'All' : 'Starred'}
                            </button>
                        ))}
                    </div>

                    {/* Sort tabs */}
                    <div className="flex items-center gap-1.5 bg-[#F4F5F7] p-1 rounded-xl overflow-x-auto no-scrollbar">
                        {([
                            { key: 'recent', label: 'Recent' },
                            { key: 'alphabetical', label: 'A-Z' },
                            { key: 'favorites-first', label: 'Favorites first' }
                        ] as const).map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setSortBy(tab.key)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                                    sortBy === tab.key
                                        ? 'bg-white text-[#0052CC] shadow-sm'
                                        : 'text-[#4A5565] hover:text-[#101828]'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* View toggle */}
                    <div className="ml-auto sm:ml-0 flex items-center bg-[#F4F5F7] p-1 rounded-xl">
                        <button
                            onClick={() => setAndPersistView('grid')}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                                viewMode === 'grid'
                                    ? 'bg-white text-[#0052CC] shadow-sm'
                                    : 'text-[#4A5565] hover:text-[#101828]'
                            }`}
                            aria-label="Switch to grid view"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setAndPersistView('list')}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                                viewMode === 'list'
                                    ? 'bg-white text-[#0052CC] shadow-sm'
                                    : 'text-[#4A5565] hover:text-[#101828]'
                            }`}
                            aria-label="Switch to list view"
                        >
                            <List size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Projects */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="skeleton h-[160px] rounded-2xl" />
                    ))}
                </div>
            ) : filteredAndSortedProjects.length > 0 ? (
                viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {filteredAndSortedProjects.map((project) => (
                            <RecentProjectCard
                                key={project.id}
                                id={project.id.toString()}
                                name={project.name}
                                projectKey={project.projectKey}
                                isFavorite={project.isFavorite}
                                onFavoriteToggle={() => {
                                    void fetchProjects();
                                }}
                                type={project.type === 'AGILE' ? 'Agile Scrum' : 'Kanban'}
                                boardCount={1}
                                width="w-full"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white">
                        <table className="min-w-full text-sm font-arimo">
                            <thead className="bg-[#F8FAFC] text-[#4A5565]">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold">Project Name</th>
                                    <th className="text-left px-4 py-3 font-semibold">Type</th>
                                    <th className="text-left px-4 py-3 font-semibold">Members</th>
                                    <th className="text-left px-4 py-3 font-semibold">Last Updated</th>
                                    <th className="text-left px-4 py-3 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedProjects.map((project) => (
                                    <tr key={project.id} className="border-t border-[#EEF2F7] hover:bg-[#FAFBFF]">
                                        <td className="px-4 py-3 font-semibold text-[#101828]">
                                            <div>{project.name}</div>
                                            {project.projectKey && (
                                                <div className="text-xs text-[#6B7280] mt-0.5">{project.projectKey}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-[#EAF2FF] text-[#0052CC]">
                                                {project.type === 'AGILE' ? 'Agile' : 'Kanban'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[#4A5565]">{project.memberCount ?? '-'}</td>
                                        <td className="px-4 py-3 text-[#4A5565]">
                                            {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await api.post(`/api/projects/${project.id}/favorite`);
                                                            window.dispatchEvent(new CustomEvent('planora:favorite-toggled'));
                                                            void fetchProjects();
                                                        } catch (error) {
                                                            console.error('Failed to toggle favorite:', error);
                                                        }
                                                    }}
                                                    className={`p-2 rounded-md border transition-colors ${project.isFavorite ? 'text-[#F59E0B] border-[#FDE68A] bg-[#FFFBEB]' : 'text-[#6B7280] border-[#E5E7EB] hover:text-[#F59E0B]'}`}
                                                    aria-label={project.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill={project.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                    </svg>
                                                </button>
                                                <Link
                                                    href={`/members/${project.id}`}
                                                    className="p-2 rounded-md border border-[#E5E7EB] text-[#6B7280] hover:text-[#0052CC] hover:bg-blue-50 transition-colors"
                                                    title="Project Members"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                        <circle cx="9" cy="7" r="4" />
                                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                    </svg>
                                                </Link>
                                                <Link
                                                    href={`/summary/${project.id}`}
                                                    className="px-3 py-1.5 rounded-lg bg-[#155DFC] text-white text-xs font-semibold hover:bg-[#0E4FCC] transition-colors"
                                                >
                                                    Open
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#99A1AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3z"/><path d="M9 9h6v6H9z"/></svg>
                    </div>
                    <h3 className="text-[18px] font-bold text-[#101828]">No spaces found</h3>
                    <p className="text-[#4A5565] text-sm mt-1">
                        {searchQuery ? "Try a different search term" : "Create your first project to get started."}
                    </p>
                    {!searchQuery && (
                        <Link
                            href="/createProject"
                            className="mt-4 px-4 py-2 rounded-xl bg-[#155DFC] text-white text-sm font-semibold"
                        >
                            Create Project
                        </Link>
                    )}
                </div>
            )}

            {/* FAB — mobile only */}
            <Link href="/createProject" className="fab md:hidden flex items-center justify-center" aria-label="Create project">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            </Link>
        </div>
    );
}
