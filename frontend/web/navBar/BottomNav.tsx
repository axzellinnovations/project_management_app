'use client';

import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { LayoutDashboard, LayoutGrid, CalendarDays, User, Plus, List, Zap, FolderOpen, X } from 'lucide-react';
import { Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Left-side and right-side nav items (4 items with a center Create button)
const LEFT_NAV = [
    { label: 'Home',     icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Board',    icon: LayoutGrid,      href: '/kanban',   useProjectId: true },
] as const;

const RIGHT_NAV = [
    { label: 'Calendar', icon: CalendarDays,    href: '/calendar', useProjectId: true },
    { label: 'Profile',  icon: User,            href: '/profile' },
] as const;

// Quick-create sheet options
const CREATE_OPTIONS = [
    { label: 'New Task',    icon: List,       href: '/backlog', useProjectId: true },
    { label: 'New Sprint',  icon: Zap,        href: '/sprint-backlog', useProjectId: true },
    { label: 'New Project', icon: FolderOpen, href: '/createProject' },
] as const;

function NavItem({
    label,
    icon: Icon,
    href,
    active,
}: {
    label: string;
    icon: React.ElementType;
    href: string;
    active: boolean;
}) {
    return (
        <Link
            href={href}
            className={`relative flex flex-col items-center justify-center gap-[3px] flex-1 py-2 transition-colors duration-150 ${
                active ? 'text-[#155DFC]' : 'text-[#6A7282] hover:text-[#1D293D]'
            }`}
        >
            {active && (
                <span className="absolute top-0 inset-x-1/4 h-[2.5px] bg-[#155DFC] rounded-b-full" />
            )}
            <span className={`flex items-center justify-center transition-all ${active ? 'scale-105' : 'scale-100'}`}>
                <Icon size={21} strokeWidth={active ? 2.5 : 1.75} />
            </span>
            <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
        </Link>
    );
}

function BottomNavContent() {
    const pathname     = usePathname();
    const searchParams = useSearchParams();
    const router       = useRouter();
    const projectId    = searchParams.get('projectId');
    const [createOpen, setCreateOpen] = useState(false);

    const isActive = (href: string) => {
        if (href === '/dashboard')      return pathname === '/dashboard';
        if (href === '/kanban')         return pathname.startsWith('/kanban') || pathname.startsWith('/sprint-board');
        if (href === '/calendar')       return pathname.startsWith('/calendar');
        if (href === '/profile')        return pathname.startsWith('/profile');
        return false;
    };

    const resolveHref = (item: { href: string; useProjectId?: boolean }) => {
        if (item.useProjectId && projectId) return `${item.href}?projectId=${projectId}`;
        return item.href;
    };

    const handleCreateOption = (item: { href: string; useProjectId?: boolean }) => {
        setCreateOpen(false);
        router.push(resolveHref(item));
    };

    return (
        <>
            {/* Bottom nav bar */}
            <nav
                className="md:hidden fixed bottom-0 inset-x-0 z-[110] bg-white/90 backdrop-blur-xl border-t border-[#E3E8EF] flex items-stretch justify-around"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
            >
                {/* Left items */}
                {LEFT_NAV.map((item) => (
                    <NavItem
                        key={item.label}
                        label={item.label}
                        icon={item.icon}
                        href={resolveHref(item)}
                        active={isActive(item.href)}
                    />
                ))}

                {/* Center Create button */}
                <div className="flex items-center justify-center flex-1">
                    <button
                        onClick={() => setCreateOpen(true)}
                        aria-label="Quick create"
                        className="w-12 h-12 rounded-full bg-[#155DFC] text-white flex items-center justify-center shadow-[0_4px_14px_-2px_rgba(21,93,252,0.5)] -mt-4 transition-transform active:scale-90"
                    >
                        <Plus size={22} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Right items */}
                {RIGHT_NAV.map((item) => (
                    <NavItem
                        key={item.label}
                        label={item.label}
                        icon={item.icon}
                        href={resolveHref(item)}
                        active={isActive(item.href)}
                    />
                ))}
            </nav>

            {/* Quick-create bottom sheet */}
            <AnimatePresence>
                {createOpen && (
                    <>
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="md:hidden fixed inset-0 z-[150] bg-slate-900/50 backdrop-blur-md"
                            onClick={() => setCreateOpen(false)}
                            onTouchEnd={(e) => { e.preventDefault(); setCreateOpen(false); }}
                        />
                        <motion.div
                            key="sheet"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', stiffness: 400, damping: 38, mass: 0.7 }}
                            className="md:hidden fixed bottom-0 inset-x-0 z-[151] bg-white rounded-t-[24px] overflow-hidden"
                            style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
                        >
                            {/* Drag handle */}
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-9 h-[5px] rounded-full bg-[#D1D5DB]" />
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between px-5 pb-3 border-b border-[#F3F4F6]">
                                <span className="text-[15px] font-semibold text-[#101828]">Quick Create</span>
                                <button
                                    onClick={() => setCreateOpen(false)}
                                    className="p-1.5 rounded-full hover:bg-[#F3F4F6] transition-colors text-[#6A7282]"
                                    aria-label="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Options */}
                            <div className="px-3 py-3 flex flex-col gap-1">
                                {CREATE_OPTIONS.map((opt) => {
                                    const Icon = opt.icon;
                                    return (
                                        <button
                                            key={opt.label}
                                            onClick={() => handleCreateOption(opt)}
                                            className="flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-[#F3F4F6] active:bg-[#EEF0F4] transition-colors w-full text-left"
                                        >
                                            <span className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center text-[#155DFC]">
                                                <Icon size={20} strokeWidth={2} />
                                            </span>
                                            <span className="text-[15px] font-medium text-[#1D293D]">{opt.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

export default function BottomNav() {
    return (
        <Suspense fallback={null}>
            <BottomNavContent />
        </Suspense>
    );
}
