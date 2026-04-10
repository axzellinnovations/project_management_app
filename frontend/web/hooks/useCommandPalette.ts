'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import api from '@/lib/axios';

export interface TaskResult {
    id: number;
    title: string;
    status: string;
    priority?: string;
    projectId?: number;
}

export default function useCommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TaskResult[]>([]);
    const [highlighted, setHighlighted] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Open / close keyboard shortcut
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen((v) => !v); }
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    // Auto-focus input on open
    useEffect(() => {
        if (open) {
            setQuery(''); setResults([]); setHighlighted(0);
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
            setResults((res.data || []).filter((t) => t.title.toLowerCase().includes(lower)).slice(0, 10));
        } catch { setResults([]); }
        finally { setIsSearching(false); }
    }, []);

    // Debounced search
    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => { void search(query); }, 250);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [query, search]);

    const openTask = (id: number) => { setSelectedTaskId(id); setOpen(false); };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
        } else if (e.key === 'Enter' && results[highlighted]) {
            openTask(results[highlighted].id);
        }
    };

    return {
        open, setOpen, query, setQuery,
        results, highlighted, setHighlighted,
        isSearching, selectedTaskId, setSelectedTaskId,
        inputRef, handleKeyDown, openTask,
    };
}
