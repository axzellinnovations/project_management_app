'use client';

import { useCallback } from 'react';
import { Search, X, Layout, List, Flag, FileText, ArrowRight, Layers, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import useCommandPalette from '@/hooks/useCommandPalette';

const STATUS_LABEL: Record<string, string> = {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW: 'In Review',
    DONE: 'Done',
};

const STATUS_DOT: Record<string, string> = {
    TODO: 'bg-gray-400',
    IN_PROGRESS: 'bg-blue-500',
    IN_REVIEW: 'bg-amber-500',
    DONE: 'bg-green-500',
};

const NAV_ITEMS = [
    { label: 'Go to Board',       path: '/kanban',       icon: Layout },
    { label: 'Go to Backlog',     path: '/backlog',      icon: List },
    { label: 'Go to Sprint Board',path: '/sprint-board', icon: Layers },
    { label: 'Go to List',        path: '/list',         icon: ArrowRight },
    { label: 'Go to Milestones',  path: '/milestones',   icon: Flag },
    { label: 'Go to Pages',       path: '/pages',        icon: FileText },
];

export default function CommandPalette() {
    const router = useRouter();
    const {
        open, setOpen, query, setQuery,
        results, highlighted, setHighlighted,
        isSearching, selectedTaskId, setSelectedTaskId,
        inputRef, handleKeyDown, openTask,
    } = useCommandPalette();

    const navigateTo = useCallback((path: string) => {
        const projectId = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
        setOpen(false);
        router.push(projectId ? `${path}?projectId=${projectId}` : path);
    }, [router, setOpen]);

    if (!open && selectedTaskId === null) return null;

    const showNav = !query.trim();

    return (
        <>
            {open && (
                <div
                    className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Command palette"
                >
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

                    <div className="relative w-full max-w-xl bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-[#334155] overflow-hidden">
                        {/* Search input */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F3F4F6] dark:border-[#334155]">
                            <Search size={18} className="text-[#9CA3AF] flex-shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search tasks or navigate…"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
                                onKeyDown={handleKeyDown}
                                className="flex-1 bg-transparent text-sm text-[#101828] dark:text-[#F1F5F9] placeholder-[#9CA3AF] outline-none"
                            />
                            {query && (
                                <button type="button" onClick={() => setQuery('')} className="text-[#9CA3AF] hover:text-[#374151] dark:hover:text-[#F1F5F9]">
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Results */}
                        <div className="max-h-80 overflow-y-auto">
                            {/* Navigation section (shown when no query) */}
                            {showNav && (
                                <div>
                                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Navigate</p>
                                    {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
                                        <button
                                            key={path}
                                            type="button"
                                            onClick={() => navigateTo(path)}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F9FAFB] dark:hover:bg-[#293548] transition-colors"
                                        >
                                            <Icon size={15} className="text-[#6B7280] flex-shrink-0" />
                                            <span className="flex-1 text-sm text-[#344054] dark:text-[#F1F5F9]">{label}</span>
                                            <ChevronRight size={13} className="text-[#D1D5DB]" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Task search results */}
                            {!showNav && (
                                <>
                                    {isSearching && <p className="px-4 py-3 text-sm text-[#9CA3AF]">Searching…</p>}
                                    {!isSearching && results.length === 0 && (
                                        <p className="px-4 py-3 text-sm text-[#9CA3AF]">No tasks found for &quot;{query}&quot;</p>
                                    )}
                                    {!isSearching && results.length > 0 && (
                                        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Tasks</p>
                                    )}
                                    {results.map((task, i) => (
                                        <button
                                            key={task.id}
                                            type="button"
                                            onClick={() => openTask(task.id)}
                                            onMouseEnter={() => setHighlighted(i)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                                i === highlighted ? 'bg-blue-50 dark:bg-[#293548]' : 'hover:bg-[#F9FAFB] dark:hover:bg-[#293548]'
                                            }`}
                                        >
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[task.status] ?? 'bg-gray-400'}`} />
                                            <span className="flex-1 text-sm text-[#344054] dark:text-[#F1F5F9] truncate">{task.title}</span>
                                            <span className="text-xs text-[#9CA3AF] flex-shrink-0">{STATUS_LABEL[task.status] ?? task.status}</span>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Footer hint */}
                        <div className="border-t border-[#F3F4F6] dark:border-[#334155] px-4 py-2 flex items-center gap-3 text-[11px] text-[#9CA3AF]">
                            <span><kbd className="font-mono bg-[#F3F4F6] dark:bg-[#293548] px-1 rounded">↑↓</kbd> navigate</span>
                            <span><kbd className="font-mono bg-[#F3F4F6] dark:bg-[#293548] px-1 rounded">↵</kbd> open</span>
                            <span><kbd className="font-mono bg-[#F3F4F6] dark:bg-[#293548] px-1 rounded">Esc</kbd> close</span>
                        </div>
                    </div>
                </div>
            )}

            {selectedTaskId !== null && (
                <TaskCardModal taskId={selectedTaskId} onClose={(_wasModified) => setSelectedTaskId(null)} />
            )}
        </>
    );
}
