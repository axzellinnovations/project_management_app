'use client';

import { useEffect, useState } from 'react';
import { getUserFromToken, User } from '@/lib/auth';
import api from '@/lib/axios';
import RecentProjectCard from '../dashboard/components/RecentProjectCard';
import Link from 'next/link';

export default function SpacesPage() {
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'recent' | 'alphabetical' | 'starred'>('recent');
    const [user, setUser] = useState<User | null>(null);

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
            
            if (sortBy === 'starred') {
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
        <div className="flex flex-col gap-8 w-full max-w-[1200px] mx-auto py-12 px-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[14px] text-[#4A5565]">
                    <Link href="/dashboard" className="hover:text-[#0052CC]">Dashboard</Link>
                    <span>/</span>
                    <span className="font-medium text-[#101828]">Spaces</span>
                </div>
                <h1 className="font-arimo text-[32px] font-bold text-[#101828]">All spaces</h1>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4 border-b border-[#E5E7EB]">
                <div className="relative w-full sm:w-[320px]">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#99A1AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search spaces"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-[#D1D5DC] rounded-[8px] leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:text-sm font-arimo transition-all"
                    />
                </div>

                <div className="flex items-center gap-2 bg-[#F4F5F7] p-1 rounded-[8px]">
                    <button
                        onClick={() => setSortBy('recent')}
                        className={`px-4 py-1.5 rounded-[6px] text-[14px] font-medium transition-all ${
                            sortBy === 'recent' 
                            ? 'bg-white text-[#0052CC] shadow-sm' 
                            : 'text-[#4A5565] hover:text-[#101828]'
                        }`}
                    >
                        Recent
                    </button>
                    <button
                        onClick={() => setSortBy('alphabetical')}
                        className={`px-4 py-1.5 rounded-[6px] text-[14px] font-medium transition-all ${
                            sortBy === 'alphabetical' 
                            ? 'bg-white text-[#0052CC] shadow-sm' 
                            : 'text-[#4A5565] hover:text-[#101828]'
                        }`}
                    >
                        Alphabetical
                    </button>
                    <button
                        onClick={() => setSortBy('starred')}
                        className={`px-4 py-1.5 rounded-[6px] text-[14px] font-medium transition-all ${
                            sortBy === 'starred' 
                            ? 'bg-white text-[#0052CC] shadow-sm' 
                            : 'text-[#4A5565] hover:text-[#101828]'
                        }`}
                    >
                        Starred
                    </button>
                </div>
            </div>

            {/* Projects Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-[221.6px] bg-gray-100 animate-pulse rounded-[12px]" />
                    ))}
                </div>
            ) : filteredAndSortedProjects.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-10">
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
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#99A1AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3z"/><path d="M9 9h6v6H9z"/></svg>
                    </div>
                    <h3 className="text-[18px] font-bold text-[#101828]">No spaces found</h3>
                    <p className="text-[#4A5565]">Adjust your search or filters to find what you're looking for.</p>
                </div>
            )}
        </div>
    );
}
