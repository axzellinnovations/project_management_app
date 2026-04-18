'use client';

// ══════════════════════════════════════════════════════════════════════════════
//  GenerateReportCard.tsx
//  Banner widget on the summary dashboard — links to the dedicated Report tab
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import Link from 'next/link';
import { FileBarChart2, ArrowRight, BarChart3 } from 'lucide-react';

interface Props {
  projectId: number | string;
  isAgile: boolean;
}

export function GenerateReportCard({ projectId, isAgile }: Props) {
  return (
    <div className="h-full w-full">
      <div className="h-full bg-gradient-to-r from-[#0052CC] via-[#1A6FE0] to-[#2684FF] rounded-xl border border-blue-400/40 p-4 shadow-lg shadow-blue-500/20 text-white relative overflow-hidden group">
        {/* Decorative elements */}
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
        <div className="absolute -top-3 -right-1 w-14 h-14 bg-white/10 rounded-full blur-xl animate-pulse pointer-events-none" />
        <div className="absolute right-[-8px] top-[8px] text-white/5 rotate-[-12deg] pointer-events-none">
          <FileBarChart2 size={78} strokeWidth={1} />
        </div>

        <div className="relative z-10 flex flex-row items-center justify-between gap-4 h-full">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/[0.15] flex items-center justify-center shrink-0">
              <BarChart3 size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-arimo text-[15px] font-bold text-white truncate">
                Project Analytics Report
              </h3>
              <p className="font-arimo text-[11px] text-blue-100/80 truncate">
                {isAgile ? 'Agile / Scrum' : 'Kanban'} · Full insights + PDF &amp; Excel download
              </p>
            </div>
          </div>

          <Link
            href={`/report/${projectId}`}
            className="bento-no-drag flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-arimo text-[13px] font-bold transition-all duration-300 transform active:scale-95 shadow-sm whitespace-nowrap bg-white text-[#0052CC] border border-white hover:bg-blue-50 hover:shadow-md hover:shadow-white/20"
          >
            <ArrowRight size={15} />
            View Report
          </Link>
        </div>
      </div>
    </div>
  );
}
