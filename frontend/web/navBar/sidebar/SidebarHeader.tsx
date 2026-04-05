'use client';

import React from 'react';

export function SidebarHeader({
  collapsed,
}: {
  collapsed: boolean;
}) {
  return (
    <div
      className="h-[60px] flex items-center flex-shrink-0 border-b border-cu-border/50"
      style={{ 
        paddingLeft: collapsed ? '0' : '16px',
        justifyContent: collapsed ? 'center' : 'flex-start'
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Logo Icon */}
        <div className="w-8 h-8 flex-shrink-0 rounded-[10px] bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 flex items-center justify-center shadow-sm relative group overflow-hidden">
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="relative z-10">
            <path 
                d="M12 2L20 7V17L12 22L4 17V7L12 2Z" 
                fill="white" 
                fillOpacity="0.95" 
                className="drop-shadow-sm"
            />
            <path 
                d="M12 6L16 8.5V13.5L12 16L8 13.5V8.5L12 6Z" 
                fill="white" 
                fillOpacity="0.4" 
            />
          </svg>
        </div>

        {/* Wordmark (Website Name) */}
        {!collapsed && (
          <span
            className="font-bold text-[18px] tracking-tight text-slate-800 whitespace-nowrap block ml-1"
            style={{
               fontFamily: 'Inter, sans-serif'
            }}
          >
            Planora
          </span>
        )}
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
      className="hidden md:flex absolute top-[18px] right-[-12px] z-[200] w-[24px] h-[24px] items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg hover:scale-110 transition-all duration-200 active:scale-95"
    >
      <svg 
        width="12" 
        height="12" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
