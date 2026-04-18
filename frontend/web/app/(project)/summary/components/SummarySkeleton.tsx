'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

// 1. Metrics Grid Skeleton
export function MetricsSkeleton() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Completion Rate Card */}
            <div className="bg-white rounded-[10px] border border-gray-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] min-h-[110px] flex items-center justify-between">
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
                <div key={i} className="bg-white rounded-[10px] border border-gray-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] min-h-[110px] flex flex-col justify-between">
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
        <div className="bg-white rounded-xl border border-[#E3E8EF] overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/40">
                <Skeleton className="h-5 w-32" />
            </div>
            <div className="p-4">
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
        </div>
    );
}

// 3. Chart Skeleton
export function ChartSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm">
            <Skeleton className="h-4 w-40 mb-8" />
            <div className="h-[200px] flex items-end justify-between gap-2 px-2">
                {[...Array(8)].map((_, j) => {
                    const heights = ['40%', '75%', '50%', '85%', '25%', '65%', '45%', '90%'];
                    return (
                        <div
                            key={j}
                            className="w-full rounded-t-sm bg-gray-100 animate-pulse"
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
    );
}

// 4. Activity Sidebar Skeleton
export function ActivitySkeleton() {
    return (
        <div className="bg-white rounded-xl border border-[#E3E8EF] overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/40">
                <Skeleton className="h-5 w-32" />
            </div>
            <div className="p-4 space-y-4">
                {/* Generate Report Card skeleton */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-2xl p-5">
                    <Skeleton className="h-5 w-44 mb-2" />
                    <Skeleton className="h-3 w-56 mb-4" />
                    <Skeleton className="h-9 w-32 rounded-xl" />
                </div>

                {/* Completed Tasks skeleton */}
                <div className="space-y-3">
                    <Skeleton className="h-5 w-44 mb-2" />
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                            <Skeleton className="w-5 h-5 rounded-sm" />
                            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton className="h-3.5 w-3/4" />
                                <Skeleton className="h-2.5 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Activity Feed skeleton */}
                <div className="space-y-3">
                    <Skeleton className="h-5 w-32 mb-2" />
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-start gap-3 p-2">
                            <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton className="h-3.5 w-4/5" />
                                <Skeleton className="h-2.5 w-1/3" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// 5. Chat/Notes Skeleton
export function ChatNotesSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-[#E3E8EF] overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/40">
                <Skeleton className="h-5 w-28" />
            </div>
            <div className="p-4 min-h-[300px] space-y-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                        <Skeleton className={`h-8 rounded-2xl ${i % 2 === 0 ? 'w-3/5' : 'w-2/5'}`} />
                    </div>
                ))}
            </div>
        </div>
    );
}

// 6. Workload Skeleton
export function WorkloadSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-[#E3E8EF] overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/40">
                <Skeleton className="h-5 w-36" />
            </div>
            <div className="p-6 flex flex-col lg:flex-row gap-6">
                {/* Pie chart */}
                <div className="w-full lg:w-4/12 flex items-center justify-center">
                    <Skeleton className="w-[200px] h-[200px] rounded-full" />
                </div>
                {/* Members list */}
                <div className="w-full lg:w-8/12 space-y-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div className="space-y-1.5">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-5 w-16 rounded-full" />
                                <Skeleton className="h-2 w-[100px] rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Main assembled skeleton for the full page
export default function SummaryPageSkeleton() {
    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 pb-6 flex flex-col gap-5">
            {/* Row 1: Metrics */}
            <MetricsSkeleton />

            {/* Row 2: Main Content (2:1 split) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                {/* Left Column */}
                <div className="lg:col-span-2 flex flex-col gap-5">
                    <SprintSkeleton />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <ChartSkeleton />
                        <ChartSkeleton />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <ChartSkeleton />
                        <ChartSkeleton />
                    </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-1">
                    <ActivitySkeleton />
                </div>
            </div>

            {/* Row 3: Chat + Notes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ChatNotesSkeleton />
                <ChatNotesSkeleton />
            </div>

            {/* Row 4: Workload */}
            <WorkloadSkeleton />
        </div>
    );
}
