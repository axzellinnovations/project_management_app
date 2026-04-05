'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';

interface SearchResult {
  id: number;
  title: string;
  type: 'TASK' | 'PROJECT' | 'BOARD';
  subtitle: string;
  link: string;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get<SearchResult[]>('/api/search', { params: { query } });
        setResults(data);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleResultClick = (link: string) => {
    setIsOpen(false);
    setQuery('');
    router.push(link);
  };

  return (
    <div className="relative flex-1 max-w-[480px]" ref={searchRef}>
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
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query.trim() && setIsOpen(true)}
          placeholder="Search projects, tasks, boards..."
          className="w-full bg-slate-100/80 border border-transparent rounded-[10px] h-9 pl-10 pr-4 text-[13px] text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-500 font-outfit"
        />

        {/* Shimmer on focus-within placeholder */}
        {!query && (
          <motion.div 
            animate={{ x: ['-100%', '200%'] }} 
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 5, ease: 'linear' }}
            className="absolute top-0 bottom-0 w-12 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] pointer-events-none"
          />
        )}
      </div>

      <AnimatePresence>
        {isOpen && query.trim() && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-[300] overflow-hidden"
          >
            <div className="max-h-[400px] overflow-y-auto py-2">
              {loading ? (
                <div className="px-4 py-3 flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-lg bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-2 bg-slate-100 rounded w-1/2" />
                        <div className="h-1.5 bg-slate-50 rounded w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : results.length > 0 ? (
                results.map((res) => (
                  <button
                    key={`${res.type}-${res.id}`}
                    onClick={() => handleResultClick(res.link)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      res.type === 'PROJECT' ? 'bg-blue-100 text-blue-600' :
                      res.type === 'BOARD' ? 'bg-emerald-100 text-emerald-600' :
                      'bg-indigo-100 text-indigo-600'
                    }`}>
                      {res.type === 'PROJECT' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                      ) : res.type === 'BOARD' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                        {res.title}
                      </div>
                      <div className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
                        {res.subtitle}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-8 text-center">
                  <div className="text-slate-400 text-sm italic">No results found for &quot;{query}&quot;</div>
                </div>
              )}
            </div>
            
            {results.length > 0 && (
                <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {results.length} results found
                    </span>
                    <span className="text-[10px] text-slate-300 font-medium">
                        Press ↵ to select
                    </span>
                </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
