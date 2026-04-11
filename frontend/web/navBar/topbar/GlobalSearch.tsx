'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';

type SearchResultType = 'TASK' | 'DOCUMENT' | 'MEMBER' | 'PROJECT';

interface SearchResultBase {
  id: number;
  subtitle: string;
  url: string;
  type: SearchResultType;
}

interface TaskSearchResult extends SearchResultBase {
  id: number;
  title: string;
  projectName: string;
  status: string;
}

interface DocumentSearchResult extends SearchResultBase {
  id: number;
  title: string;
}

interface MemberSearchResult extends SearchResultBase {
  id: number;
  name: string;
}

interface ProjectSearchResult extends SearchResultBase {
  id: number;
  title: string;
}

interface GlobalSearchResult {
  tasks: TaskSearchResult[];
  documents: DocumentSearchResult[];
  members: MemberSearchResult[];
  projects: ProjectSearchResult[];
}

type FlattenedResult =
  | (TaskSearchResult & { section: 'tasks'; key: string })
  | (DocumentSearchResult & { section: 'documents'; key: string })
  | (MemberSearchResult & { section: 'members'; key: string })
  | (ProjectSearchResult & { section: 'projects'; key: string });

interface GlobalSearchProps {
  projectId?: string | null;
}

export default function GlobalSearch({ projectId }: GlobalSearchProps = {}) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'PROJECT' | 'GLOBAL'>('PROJECT');

  useEffect(() => {
    setScope(projectId ? 'PROJECT' : 'GLOBAL');
  }, [projectId]);

  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const runSearch = useCallback((value: string, currentScope: 'PROJECT' | 'GLOBAL', currentProjectId?: string | null) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const normalized = value.trim();

    if (normalized.length < 2) {
      setLoading(false);
      setResults(null);
      setSelectedIndex(-1);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params: { q: string; projectId?: string } = { q: normalized };
        if (currentScope === 'PROJECT' && currentProjectId) {
          params.projectId = currentProjectId;
        }
        const { data } = await api.get<GlobalSearchResult>('/api/search', { params });
        setResults(data);
        setSelectedIndex(-1);
      } catch (_err) {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    runSearch(query, scope, projectId);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, scope, projectId, runSearch]);

  const flatResults: FlattenedResult[] = useMemo(() => [
    ...(results?.projects?.map(item => ({ ...item, section: 'projects' as const, key: `project-${item.id}` })) || []),
    ...(results?.tasks?.map(item => ({ ...item, section: 'tasks' as const, key: `task-${item.id}` })) || []),
    ...(results?.documents?.map(item => ({ ...item, section: 'documents' as const, key: `document-${item.id}` })) || []),
    ...(results?.members?.map(item => ({ ...item, section: 'members' as const, key: `member-${item.id}` })) || []),
  ], [results]);

  const handleResultSelect = useCallback((result: FlattenedResult) => {
    setIsOpen(false);
    setQuery('');
    router.push(result.url);
  }, [router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || flatResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % flatResults.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + flatResults.length) % flatResults.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
          handleResultSelect(flatResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      default:
        break;
    }
  }, [isOpen, flatResults, selectedIndex, handleResultSelect]);

  const isEmpty = !loading && query.trim().length >= 2 && flatResults.length === 0;

  const renderIcon = (type: SearchResultType) => {
    if (type === 'TASK') {
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
    }
    if (type === 'DOCUMENT') {
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>;
    }
    if (type === 'PROJECT') {
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><rect x="7" y="7" width="3" height="10" /><rect x="14" y="7" width="3" height="6" /></svg>;
    }
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
  };

  const renderSection = (title: string, items: FlattenedResult[], startOffset: number) => {
    if (items.length === 0) return null;

    return (
      <div>
        <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</div>
        {items.map((item, idx) => {
          const absIndex = startOffset + idx;
          const isSelected = selectedIndex === absIndex;
          const colorClass = item.type === 'TASK'
            ? 'bg-indigo-100 text-indigo-600'
            : item.type === 'DOCUMENT'
              ? 'bg-amber-100 text-amber-600'
              : item.type === 'PROJECT'
                ? 'bg-purple-100 text-purple-600'
                : 'bg-green-100 text-green-600';

          return (
            <button
              key={item.key}
              onClick={() => handleResultSelect(item)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors group text-left ${
                isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-slate-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                {renderIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                  {'title' in item ? item.title : item.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative flex-1 max-w-[480px] z-[200]" ref={searchRef}>
      <div className="relative w-full group">
        <svg 
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 group-focus-within:text-blue-500 transition-colors" 
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            setIsOpen(value.trim().length > 0);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length >= 2 && setIsOpen(true)}
          placeholder="Search projects, tasks, docs..."
          className="w-full bg-slate-100/80 border border-transparent rounded-[10px] h-9 pl-10 pr-4 text-[13px] text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-500 font-outfit"
        />

        {!query && (
          <motion.div 
            animate={{ x: ['-100%', '200%'] }} 
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 5, ease: 'linear' }}
            className="absolute top-0 bottom-0 w-12 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] pointer-events-none"
          />
        )}
      </div>

      <AnimatePresence>
        {isOpen && query.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-[1050] overflow-hidden"
          >
            {projectId && (
              <div className="bg-slate-50/50 border-b border-slate-100 px-4 py-2.5 flex items-center gap-6">
                 <button 
                    onClick={() => setScope('PROJECT')}
                    className="flex items-center gap-2 cursor-pointer group focus:outline-none"
                    type="button"
                 >
                    <div className={`flex items-center justify-center w-4 h-4 rounded-full border-2 transition-all shadow-sm ${scope === 'PROJECT' ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'}`}>
                       {scope === 'PROJECT' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                    </div>
                    <span className={`text-[12px] font-semibold transition-colors ${scope === 'PROJECT' ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'}`}>This Project</span>
                 </button>
                 
                 <button 
                    onClick={() => setScope('GLOBAL')}
                    className="flex items-center gap-2 cursor-pointer group focus:outline-none"
                    type="button"
                 >
                    <div className={`flex items-center justify-center w-4 h-4 rounded-full border-2 transition-all shadow-sm ${scope === 'GLOBAL' ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'}`}>
                       {scope === 'GLOBAL' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                    </div>
                    <span className={`text-[12px] font-semibold transition-colors ${scope === 'GLOBAL' ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'}`}>All Projects</span>
                 </button>
              </div>
            )}

            <div className="max-h-[400px] overflow-y-auto py-2">
              {loading ? (
                <div className="px-4 py-8 flex items-center justify-center gap-2 text-slate-500">
                  <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
                  <span className="text-sm">Searching...</span>
                </div>
              ) : flatResults.length > 0 ? (
                <>
                  {renderSection('Projects', (results?.projects || []).map(item => ({ ...item, section: 'projects', key: `project-${item.id}` })), 0)}
                  {renderSection('Tasks', (results?.tasks || []).map(item => ({ ...item, section: 'tasks', key: `task-${item.id}` })), results?.projects?.length || 0)}
                  {renderSection('Documents', (results?.documents || []).map(item => ({ ...item, section: 'documents', key: `document-${item.id}` })), (results?.projects?.length || 0) + (results?.tasks?.length || 0))}
                  {renderSection('Members', (results?.members || []).map(item => ({ ...item, section: 'members', key: `member-${item.id}` })), (results?.projects?.length || 0) + (results?.tasks?.length || 0) + (results?.documents?.length || 0))}
                </>
              ) : isEmpty ? (
                <div className="px-4 py-8 text-center">
                  <div className="text-slate-400 text-sm italic">No results for &quot;{query}&quot;</div>
                </div>
              ) : null}
            </div>

            {flatResults.length > 0 && (
              <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {flatResults.length} results
                </span>
                <span className="text-[10px] text-slate-300 font-medium">
                  ↑↓ navigate • ↵ select • ⎋ close
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
