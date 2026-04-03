'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`rounded-cu-md bg-gradient-to-r from-cu-bg-tertiary via-cu-bg-secondary to-cu-bg-tertiary bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

// Pre-built skeleton patterns

export function SkeletonTaskRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-cu-border-light">
      <Skeleton className="w-4 h-4 rounded" />
      <Skeleton className="w-4 h-4 rounded" />
      <Skeleton className="h-4 flex-1 max-w-[240px]" />
      <Skeleton className="w-6 h-6 rounded-full ml-auto" />
      <Skeleton className="w-16 h-5 rounded" />
      <Skeleton className="w-20 h-5 rounded-full" />
    </div>
  );
}

export function SkeletonBoardCard() {
  return (
    <div className="bg-cu-bg rounded-cu-lg border border-cu-border p-3 space-y-2.5">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="w-5 h-5 rounded-full" />
        <Skeleton className="w-12 h-4 rounded" />
      </div>
    </div>
  );
}

export function SkeletonSidebarItem() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Skeleton className="w-4 h-4 rounded" />
      <Skeleton className="h-3.5 flex-1" />
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTaskRow key={i} />
      ))}
    </div>
  );
}
