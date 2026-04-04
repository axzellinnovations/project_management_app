'use client';

import React from 'react';

export function SidebarHeader({
  collapsed,
}: {
  collapsed: boolean;
}) {
  return (
    <div
      className="h-[56px] flex items-center border-b border-cu-border-light flex-shrink-0"
      style={{ justifyContent: collapsed ? 'center' : 'flex-start', paddingLeft: collapsed ? '0' : '12px' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Logo */}
        <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-gradient-to-br from-cu-primary to-cu-primary-dark flex items-center justify-center shadow-sm shadow-cu-primary/20">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" fill="white" fillOpacity="0.9" />
            <path d="M12 6L16 8.5V13.5L12 16L8 13.5V8.5L12 6Z" fill="white" fillOpacity="0.45" />
          </svg>
        </div>
        {/* Wordmark */}
        <span
          className="font-bold text-[16px] bg-gradient-to-r from-cu-primary to-cu-primary-dark bg-clip-text text-transparent whitespace-nowrap overflow-hidden"
          style={{
            maxWidth: collapsed ? '0px' : '120px',
            opacity: collapsed ? 0 : 1,
            transition: 'max-width 280ms cubic-bezier(0.4,0,0.2,1), opacity 180ms',
          }}
        >
          Planora
        </span>
      </div>
    </div>
  );
}

export function CollapseButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="hidden md:flex absolute top-[14px] right-[-13px] z-50 w-[26px] h-[26px] items-center justify-center rounded-full bg-white border border-cu-border shadow-md text-cu-text-muted hover:text-cu-primary hover:border-cu-primary/30 hover:shadow-cu-primary/10 transition-all duration-150"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1.5" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <line x1="5" y1="1.5" x2="5" y2="14.5" stroke="currentColor" strokeWidth="1.4" />
        <path
          d={collapsed ? 'M8.5 10L11 8L8.5 6' : 'M10.5 10L8 8L10.5 6'}
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
