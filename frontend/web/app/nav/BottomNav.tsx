'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutDashboard, LayoutGrid, Bell, User } from 'lucide-react';
import { Suspense } from 'react';

const NAV_ITEMS = [
    { label: 'Home',    icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Board',   icon: LayoutGrid,      href: '/kanban',   useProjectId: true },
    { label: 'Alerts',  icon: Bell,            href: '/dashboard' },
    { label: 'Profile', icon: User,            href: '/profile' },
] as const;

function BottomNavContent() {
    const pathname    = usePathname();
    const searchParams = useSearchParams();
    const projectId   = searchParams.get('projectId');

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        if (href === '/kanban')    return pathname.startsWith('/kanban') || pathname.startsWith('/sprint-board');
        if (href === '/profile')   return pathname.startsWith('/profile');
        return false;
    };

    const resolveHref = (item: typeof NAV_ITEMS[number]) => {
        if ('useProjectId' in item && item.useProjectId && projectId) {
            return `${item.href}?projectId=${projectId}`;
        }
        return item.href;
    };

    return (
        <nav
            className="md:hidden fixed bottom-0 inset-x-0 z-[110] bg-white/90 backdrop-blur-xl border-t border-[#E3E8EF] flex items-center justify-around"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
            {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                const Icon   = item.icon;
                return (
                    <Link
                        key={item.label}
                        href={resolveHref(item)}
                        className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors duration-150 ${active ? 'text-[#155DFC]' : 'text-[#6A7282] hover:text-[#1D293D]'}`}
                    >
                        <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
                        <span className={`text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>
                            {item.label}
                        </span>
                        {active && (
                            <span className="absolute top-0 w-8 h-[2px] bg-[#155DFC] rounded-b-full mx-auto" />
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}

export default function BottomNav() {
    return (
        <Suspense fallback={null}>
            <BottomNavContent />
        </Suspense>
    );
}
