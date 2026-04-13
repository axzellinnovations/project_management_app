'use client';

import { createPortal } from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, BookOpen } from 'lucide-react';

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
  const [dmsOpen, setDmsOpen] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const dmsRef = useRef<HTMLDivElement>(null);
  const dmsDropdownRef = useRef<HTMLDivElement>(null);
  const [dmsDropdownPos, setDmsDropdownPos] = useState({ top: 0, left: 0 });
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  useEffect(() => {
    const check = () => setIsSm(window.innerWidth < 768);
    check();
    const frame = window.requestAnimationFrame(() => setMounted(true));
    window.addEventListener('resize', check);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', check);
    };
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

  useEffect(() => {
    if (!dmsOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dmsRef.current && !dmsRef.current.contains(e.target as Node) &&
        (!dmsDropdownRef.current || !dmsDropdownRef.current.contains(e.target as Node))
      ) {
        setDmsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dmsOpen]);

  const visibleTabs = isSm ? tabs.slice(0, VISIBLE_TABS_SM) : tabs;
  const overflowTabs = isSm ? tabs.slice(VISIBLE_TABS_SM) : [];
  const activeInOverflow = overflowTabs.some(t => t.id === activeTab);
  const canUsePortal = typeof window !== 'undefined';

  const buildHref = (base: string) => {
    if (!projectId) return base;
    return `${base}?projectId=${projectId}`;
  };

  const effectiveActiveTab = dmsOpen ? 'dms' : activeTab;

  const renderTab = (tab: { id: string; label: string }, inOverflow = false) => {
    /* Special DMS tab — renders a dropdown */
    if (tab.id === 'dms') {
      const isDmsActive = effectiveActiveTab === 'dms';
      if (inOverflow) {
        return (
          <div key="dms" ref={dmsRef} className="relative">
            <button
              onClick={() => setDmsOpen(p => !p)}
              className={`w-full text-left block px-4 py-2.5 text-[13px] transition-all duration-200 font-outfit font-bold ${
                isDmsActive ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              DMS ▾
            </button>
            <AnimatePresence>
              {dmsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-full top-0 ml-1 w-[150px] bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-[300]"
                >
                  <button
                    onClick={() => { setDmsOpen(false); setMoreOpen(false); router.push(buildHref('/pages')); }}
                    className="flex items-center gap-2.5 px-3.5 py-2 w-full text-left text-[13px] font-outfit font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <FileText size={14} className="text-blue-500" />
                    Pages
                  </button>
                  <button
                    onClick={() => { setDmsOpen(false); setMoreOpen(false); router.push(buildHref('/pages') + (projectId ? '&view=docs' : '?view=docs')); }}
                    className="flex items-center gap-2.5 px-3.5 py-2 w-full text-left text-[13px] font-outfit font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <BookOpen size={14} className="text-indigo-500" />
                    Docs
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      }

      return (
        <div key="dms" ref={dmsRef} className="relative h-full flex items-center">
          <button
            onClick={() => {
              if (!dmsOpen && dmsRef.current) {
                const rect = dmsRef.current.getBoundingClientRect();
                setDmsDropdownPos({ top: rect.bottom, left: rect.left });
              }
              setDmsOpen(p => !p);
            }}
            onMouseEnter={() => setHoveredTab('dms')}
            onMouseLeave={() => setHoveredTab(null)}
            className="relative h-full flex items-center px-5 shrink-0 group transition-all duration-300"
          >
            {isDmsActive && (
              <motion.div
                layoutId="activeTabPill"
                className="absolute inset-x-1 inset-y-1.5 bg-gradient-to-b from-white/95 to-blue-50/90 backdrop-blur-lg rounded-xl border border-blue-400/30 shadow-[0_4px_20px_rgba(37,99,235,0.15)] z-0"
                transition={{ type: 'spring', stiffness: 410, damping: 24, mass: 0.8 }}
              />
            )}
            <AnimatePresence>
              {hoveredTab === 'dms' && !isDmsActive && (
                <motion.div
                  layoutId="hoverBackground"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-x-1.5 inset-y-2.5 bg-slate-100/50 rounded-lg -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                />
              )}
            </AnimatePresence>
            <span className={`font-outfit text-[14px] font-bold transition-all duration-300 whitespace-nowrap relative z-10 flex items-center gap-1 ${
              isDmsActive ? 'text-blue-600 scale-[1.02]' : 'text-slate-500 group-hover:text-slate-800'
            }`}>
              DMS
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                className={`transition-transform duration-200 ${dmsOpen ? 'rotate-180' : ''}`}
              >
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>

          {canUsePortal && createPortal(
            <AnimatePresence>
              {dmsOpen && (
                <motion.div
                  ref={dmsDropdownRef}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="fixed z-[9999] mt-1 bg-white border border-slate-200 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.10)] py-1.5 min-w-[140px] overflow-hidden"
                  style={{ top: dmsDropdownPos.top, left: dmsDropdownPos.left }}
                >
                  <button
                    onClick={() => { setDmsOpen(false); router.push(buildHref('/pages')); }}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 w-full text-left text-[13px] font-outfit font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <FileText size={14} className="text-blue-500" />
                    Pages
                  </button>
                  <button
                    onClick={() => { setDmsOpen(false); router.push(buildHref('/pages') + (projectId ? '&view=docs' : '?view=docs')); }}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 w-full text-left text-[13px] font-outfit font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <BookOpen size={14} className="text-indigo-500" />
                    Docs
                  </button>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}
        </div>
      );
    }

    /* Standard tab */
    if (inOverflow) {
      return (
        <Link
          key={tab.id}
          href={getTabHref(tab.id)}
          onClick={() => setMoreOpen(false)}
          className={`block px-4 py-2.5 text-[13px] transition-all duration-200 font-outfit font-bold ${
            effectiveActiveTab === tab.id ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          {tab.label}
        </Link>
      );
    }

    return (
      <Link
        key={tab.id}
        href={getTabHref(tab.id)}
        onMouseEnter={() => setHoveredTab(tab.id)}
        onMouseLeave={() => setHoveredTab(null)}
        className="relative h-full flex items-center px-5 shrink-0 group transition-all duration-300"
      >
        {effectiveActiveTab === tab.id && (
          <motion.div
            layoutId="activeTabPill"
            className="absolute inset-x-1 inset-y-1.5 bg-gradient-to-b from-white/95 to-blue-50/90 backdrop-blur-lg rounded-xl border border-blue-400/30 shadow-[0_4px_20px_rgba(37,99,235,0.15)] z-0"
            transition={{ type: 'spring', stiffness: 410, damping: 24, mass: 0.8 }}
          />
        )}
        <AnimatePresence>
          {hoveredTab === tab.id && effectiveActiveTab !== tab.id && (
            <motion.div
              layoutId="hoverBackground"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-x-1.5 inset-y-2.5 bg-slate-100/50 rounded-lg -z-10"
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            />
          )}
        </AnimatePresence>
        <span
          className={`font-outfit text-[14px] font-bold transition-all duration-300 whitespace-nowrap relative z-10 ${
            effectiveActiveTab === tab.id ? 'text-blue-600 scale-[1.02]' : 'text-slate-500 group-hover:text-slate-800'
          }`}
        >
          {tab.label}
        </span>
      </Link>
    );
  };

  return (
    <div className="h-[44px] flex items-center relative">
      <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth h-full" onScroll={() => dmsOpen && setDmsOpen(false)}>
        <div className="flex items-center h-full gap-1">
          {visibleTabs.map(tab => renderTab(tab, false))}
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

          <AnimatePresence>
            {moreOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute top-full right-0 mt-2 z-[200] bg-white border border-slate-200 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] py-1.5 min-w-[160px] overflow-hidden"
              >
                {overflowTabs.map(tab => renderTab(tab, true))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
