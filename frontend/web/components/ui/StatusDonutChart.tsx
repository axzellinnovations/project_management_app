'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';

interface StatusDonutChartProps {
    items: { status?: string | null }[];
    onHover: (status: string | null) => void;
}

const STATUSES = [
    { key: 'TODO', label: 'To Do', color: '#D1D5DB' },
    { key: 'IN_PROGRESS', label: 'In Progress', color: '#3B82F6' },
    { key: 'IN_REVIEW', label: 'In Review', color: '#F59E0B' }
];

const RADIUS = 64;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function StatusDonutChart({ items, onHover }: StatusDonutChartProps) {
    const data = useMemo(() => {
        const itemsData = items || [];
        const counts = STATUSES.map(s => ({
            ...s,
            count: itemsData.filter(i => i.status === s.key).length
        }));
        const total = counts.reduce((acc, curr) => acc + curr.count, 0);

        const slicesWithOrigin = counts.map((slice, index, arr) => {
            const proportion = total > 0 ? slice.count / total : 0;
            const currentOrigin = arr.slice(0, index).reduce((sum, s) => sum + (total > 0 ? s.count / total : 0), 0);
            return {
                ...slice,
                proportion,
                currentOrigin,
                dashLength: proportion * CIRCUMFERENCE
            };
        });

        return { counts, total, slicesWithOrigin };
    }, [items]);

    // Counter Snap Animation
    const [displayCount, setDisplayCount] = useState(0);
    useEffect(() => {
        if (data.total === 0) {
            const t = setTimeout(() => setDisplayCount(0), 0);
            return () => clearTimeout(t);
        }
        const start = 0;
        const end = data.total;
        const duration = 600; // 600ms to 1200ms range roughly
        const startTime = performance.now();

        const update = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // easeOutQuad
            const easeOut = 1 - (1 - progress) * (1 - progress);
            setDisplayCount(Math.round(start + (end - start) * easeOut));
            
            if (progress < 1) requestAnimationFrame(update);
        };
        const timer = setTimeout(() => requestAnimationFrame(update), 600); // start at 600ms
        
        return () => clearTimeout(timer);
    }, [data.total]);

    const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

    const handleHover = (status: string | null) => {
        setHoveredSlice(status);
        onHover(status);
    };

    if (data.total === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[250px] w-full p-4">
                <div className="relative flex items-center justify-center w-40 h-40">
                    <svg className="w-full h-full" viewBox="0 0 160 160">
                        <circle 
                            cx="80" cy="80" r={RADIUS} 
                            fill="none" stroke="#E5E7EB" strokeWidth="14" 
                            strokeDasharray="4 8" strokeLinecap="round" 
                        />
                    </svg>
                    <div className="absolute text-center flex flex-col items-center">
                        <span className="text-[28px] font-bold text-gray-300 font-sans leading-none">0</span>
                        <span className="text-[11px] font-medium text-gray-400 mt-1 uppercase tracking-widest">Tasks</span>
                    </div>
                </div>
                <div className="mt-8 text-[13px] text-gray-400 font-medium tracking-wide">ZERO TASKS REQUIRED</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[250px] w-full p-6">
            <div className="relative flex items-center justify-center w-48 h-48">
                <motion.div
                    animate={{ 
                        rotate: 360,
                        scale: [1, 1.03, 1]
                    }}
                    transition={{ 
                        rotate: { duration: 60, repeat: Infinity, ease: "linear" },
                        scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                    }}
                    className="w-full h-full"
                >
                    <svg className="w-full h-full transform -rotate-90 pointer-events-none" viewBox="0 0 160 160">
                        {/* Background Track */}
                        <motion.circle 
                            cx="80" 
                            cy="80" 
                            r={RADIUS} 
                            fill="none" 
                            stroke="#F3F4F6" 
                            strokeWidth="14"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, delay: 0.3 }}
                        />
                        
                        {/* Data Segments */}
                        {data.slicesWithOrigin.map((slice, index) => {
                            if (slice.count === 0) return null;
    
                            return (
                                <motion.circle
                                    key={slice.key}
                                    cx="80"
                                    cy="80"
                                    r={RADIUS}
                                    fill="none"
                                    stroke={slice.color}
                                    strokeWidth="14"
                                    strokeLinecap="round"
                                    strokeDasharray={`${slice.dashLength} ${CIRCUMFERENCE}`}
                                    strokeDashoffset={-slice.currentOrigin * CIRCUMFERENCE}
                                    initial={{ strokeDasharray: `0 ${CIRCUMFERENCE}` }}
                                    animate={{ strokeDasharray: `${slice.dashLength} ${CIRCUMFERENCE}` }}
                                    transition={{
                                        duration: 0.9,
                                        delay: 0.3 + (index * 0.15), // Staggered entry logic
                                        ease: [0.16, 1, 0.3, 1] // ease-out-expo
                                    }}
                                    className="transition-all duration-300 pointer-events-auto cursor-pointer"
                                    style={{
                                        transformOrigin: '80px 80px',
                                        scale: hoveredSlice === slice.key ? 1.05 : hoveredSlice ? 0.95 : 1,
                                        filter: hoveredSlice === slice.key ? 'brightness(1.15)' : 'brightness(1)'
                                    }}
                                    onMouseEnter={() => handleHover(slice.key)}
                                    onMouseLeave={() => handleHover(null)}
                                />
                            );
                        })}
                    </svg>
                </motion.div>

                {/* Center Metrics Inside Donut */}
                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                    <motion.span 
                        className="text-[38px] font-bold text-gray-800 font-sans leading-none tracking-tight"
                    >
                        {displayCount}
                    </motion.span>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                        Active Tasks
                    </span>
                </div>

                {/* Tooltip Float */}
                <AnimatePresence>
                    {hoveredSlice && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 5, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            className="absolute -top-10 bg-gray-900 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap pointer-events-none z-50 flex items-center gap-2"
                        >
                            {(() => {
                                const activeSlice = data.counts.find(s => s.key === hoveredSlice);
                                if (!activeSlice) return null;
                                const pct = Math.round((activeSlice.count / data.total) * 100);
                                return (
                                    <>
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeSlice.color }}></span>
                                        {activeSlice.label}: {activeSlice.count} ({pct}%)
                                    </>
                                );
                            })()}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Interactive Legend Dots Below */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="flex items-center gap-4 mt-8"
            >
                {data.counts.map(slice => (
                    <div 
                        key={slice.key} 
                        className={`flex items-center gap-1.5 cursor-pointer transition-opacity duration-300 ${hoveredSlice && hoveredSlice !== slice.key ? 'opacity-40' : 'opacity-100 hover:opacity-80'}`}
                        onMouseEnter={() => handleHover(slice.key)}
                        onMouseLeave={() => handleHover(null)}
                    >
                        <span className="w-2.5 h-2.5 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]" style={{ backgroundColor: slice.color }}></span>
                        <span className="text-[12px] font-medium text-gray-600 font-arimo">{slice.label}</span>
                    </div>
                ))}
            </motion.div>
        </div>
    );
}
