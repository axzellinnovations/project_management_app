'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const VISIBLE_TABS_SM = 5;

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
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsSm(window.innerWidth < 640);
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
    <div className="h-[45px] bg-white border-b border-cu-border flex items-end">
      <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth px-4 sm:px-8">
        <div className="flex items-end gap-4 sm:gap-8 min-w-max">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.id}
              href={getTabHref(tab.id)}
              className="relative pb-3 px-1 shrink-0"
            >
              <span
                className={`font-inter text-[13px] sm:text-[14px] leading-[20px] transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'text-cu-text-primary font-semibold'
                    : 'text-cu-text-muted font-medium hover:text-cu-text-primary'
                }`}
              >
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-cu-primary rounded-t-[2px]"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          ))}
        </div>
      </div>

      {overflowTabs.length > 0 && (
        <div ref={moreRef} className="relative pb-3 pr-4 flex-shrink-0 self-end">
          <button
            onClick={() => setMoreOpen(p => !p)}
            className={`flex items-center gap-1 font-inter text-[13px] font-medium transition-colors duration-200 ${
              activeInOverflow || moreOpen ? 'text-cu-text-primary font-semibold' : 'text-cu-text-muted hover:text-cu-text-primary'
            }`}
          >
            More
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`}>
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {activeInOverflow && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-cu-primary rounded-t-[2px]" />
          )}
          {moreOpen && (
            <div className="absolute top-full right-0 mt-1 z-[200] bg-white/90 backdrop-blur-xl border border-cu-border rounded-xl shadow-xl py-1 min-w-[140px]"
              style={{ animation: 'dropdownIn 150ms ease forwards' }}
            >
              {overflowTabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={getTabHref(tab.id)}
                  onClick={() => setMoreOpen(false)}
                  className={`block px-4 py-2 text-[13px] transition-colors ${
                    activeTab === tab.id
                      ? 'text-cu-primary font-semibold bg-cu-primary/5'
                      : 'text-cu-text-secondary hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
