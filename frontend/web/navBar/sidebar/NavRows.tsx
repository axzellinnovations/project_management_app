'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

/* ── Nav Row ── */
export function NavRow({
  icon, label, collapsed, active = false, hasChevron = false, chevronOpen = false, badge, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  active?: boolean;
  hasChevron?: boolean;
  chevronOpen?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-left relative group ${
        active 
          ? 'bg-cu-primary/8 text-cu-primary font-semibold' 
          : 'text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary'
      }`}
    >
      {active && (
        <motion.div
          layoutId="sidebarActiveIndicator"
          className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-cu-primary rounded-r-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
      <span className="flex-shrink-0 w-[18px] flex items-center justify-center">{icon}</span>
      <span
        className="text-[13.5px] font-medium flex-1 whitespace-nowrap overflow-hidden text-left"
        style={{
          maxWidth: collapsed ? '0px' : '150px',
          opacity: collapsed ? 0 : 1,
          transition: 'max-width 280ms cubic-bezier(0.4,0,0.2,1), opacity 200ms',
        }}
      >
        {label}
      </span>
      {badge !== undefined && badge > 0 && !collapsed && (
        <span className="bg-cu-primary/10 text-cu-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
      {hasChevron && !collapsed && (
        <svg
          width="13" height="13" viewBox="0 0 13 13" fill="none"
          className="flex-shrink-0 transition-transform duration-200"
          style={{ transform: chevronOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <path d="M4.5 3L8 6.5L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/* ── Folder Nav Row ── */
export function FolderNavRow({
  icon, label, href, badge, active, collapsed,
}: {
  icon: React.ReactNode; label: string; href: string;
  badge?: number; active: boolean; collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 relative group ${
        active 
          ? 'bg-cu-primary/8 text-cu-primary font-semibold' 
          : 'text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary'
      }`}
    >
      {active && (
        <motion.div
          layoutId="sidebarActiveIndicatorFolder"
          className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-cu-primary rounded-r-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
      <span className="flex-shrink-0 w-[18px] flex items-center justify-center">{icon}</span>
      <span
        className="text-[13.5px] font-medium flex-1 whitespace-nowrap overflow-hidden"
        style={{
          maxWidth: collapsed ? '0px' : '130px',
          opacity: collapsed ? 0 : 1,
          transition: 'max-width 280ms cubic-bezier(0.4,0,0.2,1), opacity 200ms',
        }}
      >
        {label}
      </span>
      {badge !== undefined && badge > 0 && !collapsed && (
        <span className="ml-auto bg-cu-bg-tertiary text-cu-text-secondary text-[11px] px-1.5 py-0.5 rounded min-w-[20px] text-center font-medium">
          {badge}
        </span>
      )}
    </Link>
  );
}

/* ── Section Header ── */
export function SectionHeader({ label, collapsed, expanded, badge, onToggle }: {
  label: string; collapsed: boolean; expanded: boolean; badge?: number; onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-2 px-2.5 py-1.5 mb-0.5 group">
      <svg
        width="9" height="9" viewBox="0 0 10 10" fill="none"
        className="text-cu-text-muted flex-shrink-0 transition-transform duration-200"
        style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
      >
        <path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span
        className="text-[10.5px] font-bold text-cu-text-muted uppercase tracking-widest whitespace-nowrap overflow-hidden transition-all duration-300"
        style={{
          maxWidth: collapsed ? '0px' : '150px',
          opacity: collapsed ? 0 : 1,
        }}
      >
        {label}
      </span>
      {badge !== undefined && badge > 0 && !collapsed && (
        <span className="ml-auto bg-cu-primary/10 text-cu-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

