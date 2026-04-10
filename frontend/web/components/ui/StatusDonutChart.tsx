'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useDonutChart, RADIUS, CIRCUMFERENCE } from '@/hooks/useDonutChart';
import DonutEmptyState from './DonutEmptyState';

interface StatusDonutChartProps {
    items: { status?: string | null }[];
    onHover: (status: string | null) => void;
}

export default function StatusDonutChart({ items, onHover }: StatusDonutChartProps) {
    const { data, displayCount } = useDonutChart(items);
    const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

    const handleHover = (status: string | null) => {
        setHoveredSlice(status);
        onHover(status);
    };

    if (data.total === 0) return <DonutEmptyState />;

    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[250px] w-full p-6">
            <div className="relative flex items-center justify-center w-48 h-48">
                <motion.div
                    animate={{ rotate: 360, scale: [1, 1.03, 1] }}
                    transition={{
                        rotate: { duration: 60, repeat: Infinity, ease: 'linear' },
                        scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
                    }}
                    className="w-full h-full"
                >
                    <svg className="w-full h-full transform -rotate-90 pointer-events-none" viewBox="0 0 160 160">
                        <motion.circle
                            cx="80" cy="80" r={RADIUS} fill="none" stroke="#F3F4F6" strokeWidth="14"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.3 }}
                        />
                        {data.slicesWithOrigin.map((slice, index) => {
                            if (slice.count === 0) return null;
                            return (
                                <motion.circle
                                    key={slice.key}
                                    cx="80" cy="80" r={RADIUS} fill="none"
                                    stroke={slice.color} strokeWidth="14" strokeLinecap="round"
                                    strokeDasharray={`${slice.dashLength} ${CIRCUMFERENCE}`}
                                    strokeDashoffset={-slice.currentOrigin * CIRCUMFERENCE}
                                    initial={{ strokeDasharray: `0 ${CIRCUMFERENCE}` }}
                                    animate={{ strokeDasharray: `${slice.dashLength} ${CIRCUMFERENCE}` }}
                                    transition={{ duration: 0.9, delay: 0.3 + index * 0.15, ease: [0.16, 1, 0.3, 1] }}
                                    className="transition-all duration-300 pointer-events-auto cursor-pointer"
                                    style={{
                                        transformOrigin: '80px 80px',
                                        scale: hoveredSlice === slice.key ? 1.05 : hoveredSlice ? 0.95 : 1,
                                        filter: hoveredSlice === slice.key ? 'brightness(1.15)' : 'brightness(1)',
                                    }}
                                    onMouseEnter={() => handleHover(slice.key)}
                                    onMouseLeave={() => handleHover(null)}
                                />
                            );
                        })}
                    </svg>
                </motion.div>

                {/* Center metric */}
                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                    <motion.span className="text-[38px] font-bold text-gray-800 font-sans leading-none tracking-tight">
                        {displayCount}
                    </motion.span>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">Active Tasks</span>
                </div>

                {/* Hover tooltip */}
                <AnimatePresence>
                    {hoveredSlice && (() => {
                        const active = data.counts.find((s) => s.key === hoveredSlice);
                        if (!active) return null;
                        const pct = Math.round((active.count / data.total) * 100);
                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 5, scale: 0.9 }}
                                transition={{ duration: 0.15 }}
                                className="absolute -top-10 bg-gray-900 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap pointer-events-none z-50 flex items-center gap-2"
                            >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active.color }} />
                                {active.label}: {active.count} ({pct}%)
                            </motion.div>
                        );
                    })()}
                </AnimatePresence>
            </div>

            {/* Legend */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="flex items-center gap-4 mt-8"
            >
                {data.counts.map((slice) => (
                    <div
                        key={slice.key}
                        className={`flex items-center gap-1.5 cursor-pointer transition-opacity duration-300 ${
                            hoveredSlice && hoveredSlice !== slice.key ? 'opacity-40' : 'opacity-100 hover:opacity-80'
                        }`}
                        onMouseEnter={() => handleHover(slice.key)}
                        onMouseLeave={() => handleHover(null)}
                    >
                        <span className="w-2.5 h-2.5 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]" style={{ backgroundColor: slice.color }} />
                        <span className="text-[12px] font-medium text-gray-600 font-arimo">{slice.label}</span>
                    </div>
                ))}
            </motion.div>
        </div>
    );
}
