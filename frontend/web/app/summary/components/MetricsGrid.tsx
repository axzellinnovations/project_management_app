'use client';

import { motion } from 'framer-motion';

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
};

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

function MetricCard({
    icon,
    value,
    label,
    iconBg,
    iconColor
}: {
    icon: React.ReactNode,
    value: string,
    label: string,
    iconBg: string,
    iconColor: string
}) {
    return (
        <motion.div
            variants={itemVariants}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="bg-white rounded-[10px] border border-gray-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,82,204,0.08)] hover:border-[#0052CC]/20 transition-all duration-200 h-[120px] flex flex-col justify-between relative group pointer-events-auto cursor-default"
        >
            <div className="flex justify-between items-start">
                <p className="font-arimo text-[14px] text-gray-500 font-medium group-hover:text-[#0052CC] transition-colors">{label}</p>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg} text-[${iconColor}]`}>
                    {icon}
                </div>
            </div>
            <h3 className="font-arimo text-[28px] text-gray-900 leading-none font-bold mt-auto">{value}</h3>
        </motion.div>
    );
}

function SmallCircularProgress({ percentage }: { percentage: number }) {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative w-[48px] h-[48px] flex items-center justify-center shrink-0">
            <svg className="transform -rotate-90 w-full h-full">
                <circle
                    cx="24"
                    cy="24"
                    r={radius}
                    stroke="#E3E8EF"
                    strokeWidth="4"
                    fill="transparent"
                />
                <circle
                    cx="24"
                    cy="24"
                    r={radius}
                    stroke="url(#gradient)"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0052CC" />
                        <stop offset="100%" stopColor="#0747A6" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute flex items-center justify-center">
                <span className="font-arimo text-[12px] font-bold text-[#101828]">{percentage}%</span>
            </div>
        </div>
    );
}

export default function MetricsGrid() {
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
            {/* Completion Rate */}
            <motion.div 
                variants={itemVariants} 
                whileHover={{ y: -2, transition: { duration: 0.2 } }} 
                className="bg-white rounded-[10px] border border-gray-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,82,204,0.08)] hover:border-[#0052CC]/20 transition-all duration-200 h-[120px] flex items-center justify-between group pointer-events-auto cursor-default"
            >
                <div className="flex flex-col h-full justify-between">
                    <p className="font-arimo text-[14px] text-gray-500 font-medium group-hover:text-[#0052CC] transition-colors">Overall Progress</p>
                    <div className="flex flex-col">
                         <span className="font-arimo text-[24px] text-[#0052CC] leading-none font-bold mt-1">On Track</span>
                    </div>
                </div>
                <div className="mt-auto mb-1">
                    <SmallCircularProgress percentage={0} />
                </div>
            </motion.div>

            {/* Total Tasks */}
            <MetricCard
                iconBg="bg-[#EAF2FF]"
                iconColor="#0052CC"
                icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0052CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                }
                value="0"
                label="Total Tasks"
            />

            {/* Completed Tasks */}
            <MetricCard
                iconBg="bg-[#EAF2FF]"
                iconColor="#0052CC"
                icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0052CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <path d="M22 4L12 14.01l-3-3" />
                    </svg>
                }
                value="0"
                label="Completed Tasks"
            />

            {/* Due Tasks */}
            <MetricCard
                iconBg="bg-[#EAF2FF]"
                iconColor="#0052CC"
                icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0052CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                }
                value="0"
                label="Due Issues"
            />
        </motion.div>
    );
}
