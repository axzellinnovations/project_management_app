'use client';

import { useState, useEffect } from 'react';
import { motion, animate } from 'framer-motion';

function SmallCircularProgress({ percentage }: { percentage: number }) {
    const [displayValue, setDisplayValue] = useState(0);
    const radius = 26;
    const circumference = 2 * Math.PI * radius;
    
    useEffect(() => {
        const controls = animate(0, percentage, {
            duration: 2,
            ease: "easeOut",
            onUpdate: (v: number) => setDisplayValue(Math.round(v))
        });
        return () => controls.stop();
    }, [percentage]);

    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative w-[68px] h-[68px] flex items-center justify-center shrink-0">
            <svg 
                viewBox="0 0 68 68" 
                className="transform -rotate-90 w-full h-full overflow-visible"
            >
                {/* Background track */}
                <circle
                    cx="34"
                    cy="34"
                    r={radius}
                    stroke="#F3F4F6"
                    strokeWidth="5"
                    fill="transparent"
                />
                
                {/* Glow layer (Liquid appearance) */}
                <motion.circle
                    cx="34"
                    cy="34"
                    r={radius}
                    stroke="url(#progressGradient)"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference, opacity: 0 }}
                    animate={{ 
                        strokeDashoffset, 
                        opacity: [0.2, 0.4, 0.2],
                        scale: [1, 1.02, 1]
                    }}
                    transition={{ 
                        strokeDashoffset: { duration: 2, ease: "easeOut" },
                        opacity: { repeat: Infinity, duration: 3, ease: "easeInOut" },
                        scale: { repeat: Infinity, duration: 3, ease: "easeInOut" }
                    }}
                    strokeLinecap="round"
                    className="opacity-40"
                />

                {/* Main progress stroke */}
                <motion.circle
                    cx="34"
                    cy="34"
                    r={radius}
                    stroke="url(#progressGradient)"
                    strokeWidth="5"
                    fill="transparent"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    strokeLinecap="round"
                />

                <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <motion.stop 
                            offset="0%" 
                            animate={{ stopColor: ["#0052CC", "#3B82F6", "#0052CC"] }}
                            transition={{ repeat: Infinity, duration: 4 }}
                        />
                        <motion.stop 
                            offset="100%" 
                            animate={{ stopColor: ["#0747A6", "#2563EB", "#0747A6"] }}
                            transition={{ repeat: Infinity, duration: 4 }}
                        />
                    </linearGradient>
                </defs>
            </svg>
            
            {/* Percentage text */}
            <div className="absolute flex flex-col items-center justify-center pt-0.5">
                <span className="font-arimo text-[14px] font-bold text-[#101828] leading-none">{displayValue}%</span>
            </div>
        </div>
    );
}

export function OverallProgressWidget({ completedTasks, totalTasks }: { completedTasks: number, totalTasks: number }) {
    const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return (
        <div className="h-full w-full flex items-center justify-between group pointer-events-auto cursor-default overflow-hidden relative">
            <div className="flex flex-col h-full justify-center min-w-0 pr-2">
                <p className="font-arimo text-[14px] text-gray-500 font-medium group-hover:text-[#0052CC] transition-colors truncate mb-1">Overall Progress</p>
                <div className="flex flex-col mb-1">
                     <span className="font-arimo text-[24px] text-[#0052CC] leading-none font-bold truncate">
                         {percentage === 100 ? "Completed" : percentage >= 50 ? "On Track" : "At Risk"}
                     </span>
                </div>
            </div>
            <div className="flex items-center shrink-0">
                <SmallCircularProgress percentage={percentage} />
            </div>
        </div>
    );
}

export function StatMetricWidget({
    icon,
    value,
    label,
    iconBg,
    iconColor
}: {
    icon: React.ReactNode,
    value: string | number,
    label: string,
    iconBg: string,
    iconColor: string
}) {
    return (
        <div className="h-full w-full flex flex-col justify-between relative group pointer-events-auto cursor-default">
            <div className="flex justify-between items-start">
                <p className="font-arimo text-[14px] text-gray-500 font-medium group-hover:text-[#0052CC] transition-colors">{label}</p>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg} text-[${iconColor}]`}>
                    {icon}
                </div>
            </div>
            <h3 className="font-arimo text-[28px] text-gray-900 leading-none font-bold mt-auto">{value}</h3>
        </div>
    );
}

// Keep a default export as fallback
export default function MetricsGrid() {
    return null;
}
