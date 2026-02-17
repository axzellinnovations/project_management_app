'use client';

import { useEffect, useState } from 'react';
import { getUserFromToken, User } from '@/lib/auth';
import Link from 'next/link';

export default function DashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState('worked-on');

    useEffect(() => {
        const userData = getUserFromToken();
        setUser(userData);
    }, []);

    const firstName = user?.username ? user.username.split(' ')[0] : 'User';

    return (
        <div className="flex flex-col gap-8 w-full max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="w-full">
                <h1 className="font-arimo text-[16px] leading-[24px] text-[#101828]">
                    Welcome Back, {user?.username || 'User'}.
                </h1>
            </div>

            {/* Recent Spaces Section */}
            <div className="flex flex-col gap-6 pb-[0.8px] border-b-[0.8px] border-[#E5E7EB]">
                <div className="flex justify-between items-center w-full">
                    <h2 className="font-arimo text-[16px] leading-[24px] text-[#101828]">Recent spaces</h2>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            {/* Tabs for Spaces */}
                            <button className="px-3 py-1.5 rounded bg-blue-50 text-[#0052CC] font-arimo text-[14px] font-medium border border-[#0052CC]/10">Recent</button>
                            <button className="px-3 py-1.5 rounded text-[#4A5565] font-arimo text-[14px] hover:bg-gray-50">Recommended</button>
                        </div>
                        <Link href="/spaces" className="font-arimo text-[16px] text-[#0052CC] hover:underline">View all spaces</Link>
                    </div>
                </div>

                {/* Spaces Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                    {/* Empty State for Spaces */}
                    <div className="col-span-1 md:col-span-2 py-8 text-center bg-gray-50 rounded border border-dashed border-gray-300">
                        <p className="font-arimo text-[14px] text-[#6A7282]">No recent spaces found</p>
                    </div>
                </div>
            </div>

            {/* Boards Section */}
            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center border-b-[0.8px] border-[#E5E7EB] pb-0">
                    <div className="flex items-center gap-6">
                        {['Worked on', 'Viewed', 'Assigned to me', 'Starred'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab.toLowerCase().replaceAll(' ', '-'))}
                                className={`pb-2 relative font-arimo text-[16px] transition-colors ${activeTab === tab.toLowerCase().replaceAll(' ', '-')
                                    ? 'text-[#0052CC] font-medium'
                                    : 'text-[#4A5565] hover:text-[#101828]'
                                    }`}
                            >
                                {tab}
                                {tab === 'Assigned to me' && (
                                    <span className="ml-2 bg-[#E5E7EB] text-[#364153] text-[12px] px-1.5 rounded">0</span>
                                )}
                                {activeTab === tab.toLowerCase().replaceAll(' ', '-') && (
                                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0052CC]" />
                                )}
                            </button>
                        ))}
                    </div>
                    <Link href="/createProject" className="text-[#0052CC] font-arimo text-[16px] hover:underline mb-2">+ Create new project</Link>
                </div>

                {/* Sub-header: Search */}
                <div className="relative w-[320px]">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#99A1AF" strokeWidth="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11L14 14" /></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search boards"
                        className="block w-full pl-10 pr-3 py-2 border border-[#D1D5DC] rounded-[4px] leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-arimo"
                    />
                </div>

                {/* Table */}
                <div className="w-full">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b-[0.8px] border-[#E5E7EB]">
                                <th className="py-2 w-[48px] text-left">
                                    <div className="w-5 h-5 bg-[#F0B100] border-2 border-[#F0B100] rounded-[2px]" />
                                </th>
                                <th className="py-2 text-left font-arimo text-[16px] font-bold text-[#364153]">Name</th>
                                <th className="py-2 text-left font-arimo text-[16px] font-bold text-[#364153]">Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Empty State for Table */}
                            <tr>
                                <td colSpan={3} className="py-8 text-center border-b-[0.8px] border-[#E5E7EB]">
                                    <p className="font-arimo text-[14px] text-[#6A7282]">No boards found</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
