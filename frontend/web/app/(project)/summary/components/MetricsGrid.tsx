'use client';

import { motion } from 'framer-motion';
import { Task } from '@/types';
import { PieChart, Pie, Cell } from 'recharts';

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
    value: string | number,
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

function SemiCircleGauge({ percentage }: { percentage: number }) {
    const data = [
        { name: 'Completed', value: percentage },
        { name: 'Remaining', value: 100 - percentage },
    ];

    return (
        <div className="relative w-[100px] h-[55px] flex items-end justify-center shrink-0 overflow-hidden">
            <PieChart width={100} height={100}>
                <Pie
                    data={data}
                    cx={50}
                    cy={50}
                    startAngle={180}
                    endAngle={0}
                    innerRadius={35}
                    outerRadius={45}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="none"
                >
                    <Cell fill="#0052CC" />
                    <Cell fill="#E3E8EF" />
                </Pie>
            </PieChart>
            <div className="absolute inset-x-0 bottom-0 flex justify-center pb-1">
                <span className="font-arimo text-[14px] font-bold text-[#101828]">{percentage}%</span>
            </div>
        </div>
    );
}

export default function MetricsGrid({ tasks = [] }: { tasks?: Task[] }) {
    // Computations
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'DONE').length;
    
    let dueIssues = 0;
    const now = new Date().getTime();
    tasks.forEach(t => {
        if (t.status !== 'DONE' && t.dueDate) {
            if (new Date(t.dueDate).getTime() < now) {
                dueIssues++;
            }
        }
    });

    const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6"
        >
            {/* Completion Rate */}
            <motion.div 
                variants={itemVariants} 
                whileHover={{ y: -2, transition: { duration: 0.2 } }} 
                className="bg-white rounded-[10px] border border-gray-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,82,204,0.08)] hover:border-[#0052CC]/20 transition-all duration-200 h-[120px] flex items-center justify-between group pointer-events-auto cursor-default col-span-2 sm:col-span-1"
            >
                <div className="flex flex-col h-full justify-between">
                    <p className="font-arimo text-[14px] text-gray-500 font-medium group-hover:text-[#0052CC] transition-colors">Overall Progress</p>
                    <div className="flex flex-col mb-1">
                         <span className="font-arimo text-[24px] text-[#0052CC] leading-none font-bold mt-1">
                             {percentage === 100 ? "Completed" : percentage >= 50 ? "On Track" : "At Risk"}
                         </span>
                    </div>
                </div>
                <div className="mt-auto flex items-end">
                    <SemiCircleGauge percentage={percentage} />
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
                value={totalTasks}
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
                value={completedTasks}
                label="Completed Tasks"
            />

            {/* Due Tasks */}
            <MetricCard
                iconBg="bg-[#FFF4ED]"
                iconColor="#DE350B"
                icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DE350B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                }
                value={dueIssues}
                label="Due Issues"
            />
        </motion.div>
    );
}
