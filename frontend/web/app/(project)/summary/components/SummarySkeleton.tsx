'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

// 1. Metrics Grid Skeleton
export function MetricsSkeleton() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {/* Completion Rate Card */}
            <div className="bg-white rounded-[10px] border border-gray-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] h-[120px] flex items-center justify-between col-span-2 sm:col-span-1">
                <div className="flex flex-col h-full justify-center min-w-0 pr-2">
                    <Skeleton className="h-3.5 w-24 mb-3" />
                    <Skeleton className="h-6 w-20" />
                </div>
                <div className="flex items-center shrink-0">
                    <Skeleton className="w-[68px] h-[68px] rounded-full" />
                </div>
            </div>

            {/* Metric Cards (Total, Completed, Due) */}
            {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-[10px] border border-gray-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] h-[120px] flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <Skeleton className="h-3.5 w-20" />
                        <Skeleton className="w-9 h-9 rounded-lg" />
                    </div>
                    <Skeleton className="h-7 w-12 mt-auto" />
                </div>
            ))}
        </div>
    );
}

// 2. Current Sprint Skeleton
export function SprintSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-[#E3E8EF] p-6 shadow-sm">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="w-24 h-8 rounded-md" />
            </div>

            <div className="mb-6">
                <div className="flex justify-between mb-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="w-full h-3 rounded-full" />
                <Skeleton className="h-3 w-48 mt-3" />
            </div>

            <Skeleton className="h-5 w-36" />
        </div>
    );
}

// 3. Activity Feed & Milestones Skeleton
export function ActivitySkeleton() {
    return (
        <div className="flex flex-col gap-6">
            {/* Activity Feed */}
            <div className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm">
                <Skeleton className="h-5 w-40 mb-5 pb-3 border-b border-gray-100" />
                <div className="relative border-l-2 border-gray-100 ml-3 pl-5 space-y-8 py-2">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="relative">
                            <Skeleton className="absolute -left-[30px] w-6 h-6 rounded-full border-2 border-white" />
                            <Skeleton className="h-4 w-3/4 mb-2" />
                            <Skeleton className="h-3 w-1/2" />
                            <Skeleton className="absolute top-0 right-0 h-3 w-12" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Upcoming Milestones */}
            <div className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm">
                <Skeleton className="h-5 w-44 mb-4 pb-3 border-b border-gray-100" />
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex justify-between items-center">
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-3.5 w-3/4" />
                                <Skeleton className="h-2.5 w-1/2" />
                            </div>
                            <Skeleton className="w-16 h-5 rounded" />
                        </div>
                    ))}
                </div>
            </div>
            
             {/* Project Docs Skeleton */}
             <div className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm">
                <Skeleton className="h-5 w-32 mb-4 pb-3 border-b border-gray-100" />
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-2 p-2">
                            <Skeleton className="w-8 h-8 rounded-md" />
                            <Skeleton className="h-3.5 flex-1" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// 4. Charts Skeleton
export function ChartsSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm">
                    <Skeleton className="h-4 w-40 mb-8" />
                    <div className="h-[200px] flex items-end justify-between gap-2 px-2">
                       {/* Mock chart bars/lines */}
                        {[...Array(8)].map((_, j) => {
                            const heights = ['40%', '75%', '50%', '85%', '25%', '65%', '45%', '90%'];
                            return (
                                <div
                                    key={j}
                                    className="w-full rounded-t-sm rounded-cu-md bg-gradient-to-r from-cu-bg-tertiary via-cu-bg-secondary to-cu-bg-tertiary bg-[length:200%_100%] animate-shimmer"
                                    style={{ height: heights[j % heights.length] }}
                                />
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-4">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-12" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// 5. Team & Workload Skeleton
export function TeamSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-[#EAECF0] p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="w-20 h-6 rounded-lg" />
            </div>

            <div className="flex flex-col gap-6">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="border-b border-gray-50 last:border-0 pb-5 last:pb-0">
                        <div className="flex items-center gap-3 mb-4">
                            <Skeleton className="w-11 h-11 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-16 rounded-full" />
                                </div>
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                        <div className="pl-[56px] space-y-3">
                            <div className="flex justify-between">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-12" />
                            </div>
                            <Skeleton className="w-full h-2.5 rounded-full" />
                            <div className="flex gap-4">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Skeleton className="w-full h-12 rounded-xl mt-6" />
        </div>
    );
}

// Main assembled skeleton for the full page
export default function SummaryPageSkeleton() {
    return (
        <div className="mobile-page-padding max-w-[1200px] mx-auto pb-6">
            {/* Metrics Section */}
            <div className="mb-6">
                <MetricsSkeleton />
            </div>

            {/* Main Grid: 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Left Column (Timeline & Sprint) - Spans 2 cols */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <SprintSkeleton />
                    <ChartsSkeleton />
                </div>

                {/* Right Column (Activity & Team) - Spans 1 col */}
                <div className="flex flex-col gap-6">
                    <ActivitySkeleton />
                    <TeamSkeleton />
                </div>

            </div>
        </div>
    );
}
