import React from 'react';
import Link from 'next/link';
import { PageItem } from '@/types';
import MotionWrapper from '../MotionWrapper';

interface ProjectDocsCardProps {
  projectId: number;
  pages?: PageItem[];
  pagesLoading?: boolean;
}

export function ProjectDocsCard({
  projectId,
  pages = [],
  pagesLoading = false,
}: ProjectDocsCardProps) {
  const recentPages = React.useMemo(
    () => [...pages].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 3),
    [pages]
  );

  return (
    <MotionWrapper className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <h2 className="font-arimo text-[16px] font-semibold text-[#101828] mb-4 border-b border-gray-100 pb-3 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2684FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        Project Docs
      </h2>

      {pagesLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-100/60 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : recentPages.length === 0 ? (
        <p className="font-arimo text-[13px] text-[#98A2B3] bg-gray-50 p-4 rounded-lg text-center border border-dashed border-gray-200">No documents found.</p>
      ) : (
        <div className="space-y-3">
          {recentPages.map(page => (
            <Link key={page.id} href={`/project/${projectId}/pages/${page.id}`} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-colors group">
              <span className="bg-blue-100 text-blue-600 p-1.5 rounded-md group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
              </span>
              <span className="font-arimo text-[13px] text-gray-800 font-medium truncate flex-1">{page.title}</span>
            </Link>
          ))}
        </div>
      )}
    </MotionWrapper>
  );
}
