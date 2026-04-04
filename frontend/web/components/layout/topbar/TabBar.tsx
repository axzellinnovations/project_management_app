'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const VISIBLE_TABS_SM = 4;

export function TabBar({
  tabs,
  activeTab,
  getTabHref,
}: {
  tabs: { id: string; label: string }[];
  activeTab: string;
  getTabHref: (id: string) => string;
}) {
  const [isSm, setIsSm] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsSm(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreOpen]);

  const visibleTabs = isSm ? tabs.slice(0, VISIBLE_TABS_SM) : tabs;
  const overflowTabs = isSm ? tabs.slice(VISIBLE_TABS_SM) : [];
  const activeInOverflow = overflowTabs.some(t => t.id === activeTab);

  return (
    <div className="h-[44px] flex items-center relative">
      <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth h-full">
        <div className="flex items-center h-full gap-1">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.id}
              href={getTabHref(tab.id)}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
              className="relative h-full flex items-center px-3.5 sm:px-4 shrink-0 group transition-all duration-300"
            >
              {/* Hover effect background */}
              <AnimatePresence>
                {hoveredTab === tab.id && (
                  <motion.div
                    layoutId="hoverBackground"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-x-1 inset-y-1.5 bg-slate-100/80 rounded-lg -z-10"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </AnimatePresence>

              <span
                className={`font-outfit text-[13.5px] font-bold transition-colors duration-300 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-600'
                    : 'text-slate-500 group-hover:text-slate-800'
                }`}
              >
                {tab.label}
              </span>

              {/* Active indicator */}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-2 right-2 h-[3px] bg-blue-600 rounded-t-[3px] shadow-[0_-1px_6px_rgba(37,99,235,0.3)]"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
            </Link>
          ))}
        </div>
      </div>

      {overflowTabs.length > 0 && (
        <div ref={moreRef} className="relative flex items-center h-full pl-2 border-l border-slate-100 ml-1">
          <button
            onClick={() => setMoreOpen(p => !p)}
            className={`flex items-center gap-1.5 px-3 h-[30px] rounded-lg transition-all duration-300 font-outfit text-[13px] font-bold ${
              activeInOverflow || moreOpen 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            More
            <svg 
              width="12" height="12" viewBox="0 0 12 12" fill="none" 
              className={`transition-transform duration-300 ${moreOpen ? 'rotate-180' : ''}`}
            >
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          
          {activeInOverflow && !moreOpen && (
             <motion.div
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-4 right-4 h-[3px] bg-blue-600 rounded-t-[3px] shadow-[0_-1px_6px_rgba(37,99,235,0.3)]"
             />
          )}

          <AnimatePresence>
            {moreOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute top-full right-0 mt-1 z-[200] bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 min-w-[160px] overflow-hidden"
              >
                {overflowTabs.map((tab) => (
                  <Link
                    key={tab.id}
                    href={getTabHref(tab.id)}
                    onClick={() => setMoreOpen(false)}
                    className={`block px-4 py-2.5 text-[13px] transition-all duration-200 font-outfit font-bold ${
                      activeTab === tab.id
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
