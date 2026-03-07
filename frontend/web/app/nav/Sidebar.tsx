'use client';

import Link from 'next/link';
import { ReactNode, useState } from 'react';
import { getUserFromToken, User } from '@/lib/auth';
import { usePathname, useRouter } from 'next/navigation';

export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const [user] = useState<User | null>(() => getUserFromToken());

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/login');
    };

    return (
        <div className="w-[260px] h-screen bg-white border-r border-[#E3E8EF] flex flex-col flex-shrink-0">
            {/* Workspace Switcher */}
            <div className="h-[70px] flex items-center px-6 border-b border-[#F2F4F7]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#0052CC] to-[#0747A6] rounded-lg shadow-sm flex items-center justify-center">
                        <span className="text-white font-bold text-sm">W</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-arimo text-[14px] font-semibold text-[#101828] leading-tight">Workspace</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-auto text-[#6A7282]">
                        <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>

            {/* Main Navigation */}
            <div className="px-4 py-6 flex flex-col gap-1 overflow-y-auto flex-1">
                <NavItem label="For you" href="#" icon={<InboxIcon />} />
                <NavItem label="Dashboard" href="/dashboard" icon={<DashboardIcon />} active={pathname.startsWith('/dashboard')} />
                <NavItem label="Profile" href="/profile" icon={<ProfileIcon />} active={pathname.startsWith('/profile')} />

                <div className="mt-6 mb-2">
                    <div className="flex items-center justify-between px-2 mb-2 group cursor-pointer">
                        <div className="flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#99A1AF] transform rotate-90">
                                <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="font-arimo text-[11px] font-bold text-[#99A1AF] uppercase tracking-wider">PROJECTS</span>
                        </div>
                        <button className="text-[#99A1AF] hover:text-[#0052CC] transition-colors p-1 rounded hover:bg-gray-100">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 2.5V9.5M2.5 6H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex flex-col gap-1">
                        {/* Empty Projects List */}
                        <div className="px-2 py-1 text-[12px] text-[#99A1AF] italic">No projects</div>
                    </div>
                </div>

                <div className="mt-4">
                    <div className="flex items-center gap-1 px-2 mb-2 group cursor-pointer">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#99A1AF] transform rotate-90">
                            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="font-arimo text-[11px] font-bold text-[#99A1AF] uppercase tracking-wider">FAVORITES</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        {/* Empty Favorites List */}
                        <div className="px-2 py-1 text-[12px] text-[#99A1AF] italic">No favorites</div>
                    </div>
                </div>
            </div>

            {/* Bottom User Section */}
            <div className="mt-auto p-4 border-t border-[#F2F4F7]">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#F2F4F7] flex items-center justify-center text-[#4A5565] font-semibold text-sm">
                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-[14px] font-medium text-[#101828] truncate">{user?.username || 'Guest'}</span>
                        <span className="text-[12px] text-[#6A7282] truncate" title={user?.email}>{user?.email || 'Please login'}</span>
                    </div>
                    <button onClick={handleLogout} className="ml-auto text-[#6A7282] hover:text-red-500 transition-colors" title="Logout">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

type NavItemProps = {
    label: string;
    href: string;
    icon: ReactNode;
    active?: boolean;
    badge?: string;
};

function NavItem({ label, href, icon, active = false, badge }: NavItemProps) {
    return (
        <Link href={href} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 ${active ? 'bg-[#EFF6FF] text-[#0052CC]' : 'text-[#4A5565] hover:bg-[#F9FAFB] hover:text-[#101828]'}`}>
            {icon}
            <span className="font-arimo text-[14px] font-medium">{label}</span>
            {badge && (
                <span className="ml-auto bg-[#F2F4F7] text-[#4A5565] text-[11px] px-2 py-0.5 rounded text-center min-w-[24px] font-medium">{badge}</span>
            )}
        </Link>
    )
}

// Icons
const DashboardIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" /><rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" /></svg>;
const InboxIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h12v12H4z" /><path d="M4 8l8 5 8-5" /></svg>;
const ProfileIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="6" r="3" /><path d="M4 16c1.2-2.7 3.5-4 6-4s4.8 1.3 6 4" /></svg>;
