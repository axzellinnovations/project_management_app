'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getUserFromToken, User } from '@/lib/auth';
import api from '@/lib/axios';
import RecentProjectCard from '../dashboard/components/RecentProjectCard';
import Link from 'next/link';

export default function SpacesPage() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const searchParams = useSearchParams();
    const [sortBy, setSortBy] = useState<'recent' | 'alphabetical' | 'favorites'>('recent');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [user, setUser] = useState<User | null>(null);

    // Set initial filter from URL param
    useEffect(() => {
        const filter = searchParams.get('filter');
        if (filter === 'favorites') setSortBy('favorites');
        else if (filter === 'recent') setSortBy('recent');
    }, [searchParams]);


    useEffect(() => {
        const userData = getUserFromToken();
        setUser(userData);

        const fetchProjects = async () => {
            try {
                const response = await api.get('/api/projects');
                setProjects(response.data);
            } catch (error) {
                console.error("Failed to fetch projects:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProjects();
    }, []);

    const filteredAndSortedProjects = [...projects]
        .filter(project => {
            const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (project.projectKey && project.projectKey.toLowerCase().includes(searchQuery.toLowerCase()));
            
            if (sortBy === 'favorites') {
                return matchesSearch && project.isFavorite;
            }
            return matchesSearch;
        })
        .sort((a, b) => {
            if (sortBy === 'alphabetical') {
                return a.name.localeCompare(b.name);
            }
            // 'recent' and 'starred' (when filtering) maintain API order
            return 0;
        });

    return (
        <div className="mobile-page-padding max-w-[1200px] mx-auto pb-28 sm:pb-8">
            {/* Header */}
            <div className="flex flex-col gap-1 mb-5">
                <div className="flex items-center gap-2 text-[13px] text-[#4A5565]">
                    <Link href="/dashboard" className="hover:text-[#0052CC]">Dashboard</Link>
                    <span>/</span>
                    <span className="font-medium text-[#101828]">Spaces</span>
                </div>
                <h1 className="font-arimo text-2xl sm:text-[32px] font-bold text-[#101828]">All spaces</h1>
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

                {/* Sort tabs */}
                <div className="flex items-center gap-1.5 bg-[#F4F5F7] p-1 rounded-xl overflow-x-auto no-scrollbar w-full sm:w-auto">
                    {(['recent', 'alphabetical', 'favorites'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setSortBy(tab)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                                sortBy === tab
                                    ? 'bg-white text-[#0052CC] shadow-sm'
                                    : 'text-[#4A5565] hover:text-[#101828]'
                            }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Projects Grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton h-[200px] rounded-xl" />
                    ))}
                </div>
            ) : filteredAndSortedProjects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {filteredAndSortedProjects.map((project) => (
                        <RecentProjectCard
                            key={project.id}
                            id={project.id.toString()}
                            name={project.name}
                            projectKey={project.projectKey}
                            isFavorite={project.isFavorite}
                            onFavoriteToggle={() => {
                                const fetchProjects = async () => {
                                    const response = await api.get('/api/projects');
                                    setProjects(response.data);
                                };
                                fetchProjects();
                            }}
                            type={project.type === 'AGILE' ? 'Agile Scrum' : 'Kanban'}
                            boardCount={1}
                            width="w-full"
                        />
                    ))}
                </div>
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
