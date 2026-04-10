'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import api from '@/lib/axios';
import TaskCardModal from '@/app/taskcard/TaskCardModal';

interface TaskResult {
    id: number;
    title: string;
    status: string;
    priority?: string;
    projectId?: number;
}

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

export default function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TaskResult[]>([]);
    const [highlighted, setHighlighted] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Open on Cmd+K / Ctrl+K
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen((v) => !v);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setQuery('');
            setResults([]);
            setHighlighted(0);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);

    const search = useCallback(async (q: string) => {
        const projectId = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
        if (!q.trim() || !projectId) { setResults([]); return; }
        setIsSearching(true);
        try {
            const res = await api.get<TaskResult[]>(`/api/tasks/project/${projectId}`);
            const lower = q.toLowerCase();
            setResults(
                (res.data || [])
                    .filter((t) => t.title.toLowerCase().includes(lower))
                    .slice(0, 10)
            );
        } catch {
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Debounced search
    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => { void search(query); }, 250);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [query, search]);

    const open_task = (id: number) => {
        setSelectedTaskId(id);
        setOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
        } else if (e.key === 'Enter' && results[highlighted]) {
            open_task(results[highlighted].id);
        }
    };

    if (!open && selectedTaskId === null) return null;

    return (
        <>
            {open && (
                <div
                    className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Command palette"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                    />

                    {/* Panel */}
                    <div className="relative w-full max-w-xl bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-[#334155] overflow-hidden">
                        {/* Search input */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F3F4F6] dark:border-[#334155]">
                            <Search size={18} className="text-[#9CA3AF] flex-shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search tasks…"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
                                onKeyDown={handleKeyDown}
                                className="flex-1 bg-transparent text-sm text-[#101828] dark:text-[#F1F5F9] placeholder-[#9CA3AF] outline-none"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="text-[#9CA3AF] hover:text-[#374151] dark:hover:text-[#F1F5F9]"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Results */}
                        <div className="max-h-80 overflow-y-auto">
                            {isSearching && (
                                <p className="px-4 py-3 text-sm text-[#9CA3AF]">Searching…</p>
                            )}
                            {!isSearching && query && results.length === 0 && (
                                <p className="px-4 py-3 text-sm text-[#9CA3AF]">No tasks found for &quot;{query}&quot;</p>
                            )}
                            {!isSearching && !query && (
                                <p className="px-4 py-3 text-sm text-[#9CA3AF]">Type to search tasks in the current project.</p>
                            )}
                            {results.map((task, i) => (
                                <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => open_task(task.id)}
                                    onMouseEnter={() => setHighlighted(i)}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                        i === highlighted
                                            ? 'bg-blue-50 dark:bg-[#293548]'
                                            : 'hover:bg-[#F9FAFB] dark:hover:bg-[#293548]'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[task.status] ?? 'bg-gray-400'}`} />
                                    <span className="flex-1 text-sm text-[#344054] dark:text-[#F1F5F9] truncate">{task.title}</span>
                                    <span className="text-xs text-[#9CA3AF] flex-shrink-0">
                                        {STATUS_LABEL[task.status] ?? task.status}
                                    </span>
                                </button>
                            ))}
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
                <TaskCardModal
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                />
            )}
        </>
    );
}
