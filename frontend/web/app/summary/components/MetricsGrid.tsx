'use client';

import { motion } from 'framer-motion';

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

function MetricCard({
    icon,
    value,
    label,
    caption,
    captionColor,
    iconBg,
    iconBorder
}: {
    icon: React.ReactNode,
    value: string,
    label: string,
    caption?: string,
    captionColor?: string,
    iconBg: string,
    iconBorder: string
}) {
    return (
        <motion.div
            variants={itemVariants}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="bg-white rounded-xl border border-[#E3E8EF] p-6 shadow-sm hover:shadow-md transition-shadow duration-200 h-[280px] flex flex-col justify-between relative overflow-hidden group"
        >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
                {icon}
            </div>

            <div className="mt-auto">
                <h3 className="font-arimo text-[36px] text-[#101828] leading-[40px] mb-1 font-medium">{value}</h3>
                <p className="font-arimo text-[15px] text-[#6A7282] font-medium">{label}</p>
                {caption && (
                    <p className={`font-arimo text-[13px] mt-1 ${captionColor} font-medium`}>
                        {caption}
                    </p>
                )}
            </div>
        </motion.div>
    );
}

function CircularProgress({ percentage }: { percentage: number }) {
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative w-[192px] h-[192px] flex items-center justify-center">
            <svg className="transform -rotate-90 w-full h-full">
                <circle
                    cx="96"
                    cy="96"
                    r={radius}
                    stroke="#E3E8EF"
                    strokeWidth="12"
                    fill="transparent"
                />
                <circle
                    cx="96"
                    cy="96"
                    r={radius}
                    stroke="url(#gradient)"
                    strokeWidth="12"
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
                <span className="font-arimo text-[48px] text-[#101828]">{percentage}%</span>
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
            <motion.div variants={itemVariants} whileHover={{ y: -5, transition: { duration: 0.2 } }} className="bg-white rounded-xl border border-[#E3E8EF] p-6 shadow-sm hover:shadow-md transition-shadow duration-200 h-[280px] flex flex-col items-center justify-center relative">
                <CircularProgress percentage={0} />
                <p className="font-arimo text-[15px] text-[#6A7282] font-medium mt-4">Overall Completion Rate</p>
            </motion.div>

            {/* Total Tasks */}
            <MetricCard
                iconBg="bg-[#F9FAFB]"
                iconBorder="border-[#0052CC]"
                icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0052CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                }
                value="0"
                label="Total Tasks"
            />

            {/* Completed Tasks */}
            <MetricCard
                iconBg="bg-[#F9FAFB]"
                iconBorder="border-[#00875A]"
                icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00875A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <path d="M22 4L12 14.01l-3-3" />
                    </svg>
                }
                value="0"
                label="Completed Tasks"
            />

            {/* Due Tasks */}
            <MetricCard
                iconBg="bg-[#F9FAFB]"
                iconBorder="border-[#DE350B]"
                icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DE350B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                }
                value="0"
                label="Due Tasks"
            />
        </motion.div>
    );
}
