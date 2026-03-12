'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useState } from 'react';

interface RecentProjectCardProps {
    id: string;
    name: string;
    projectKey?: string;
    description?: string;
    iconText?: string;
    type?: string;
    boardCount?: number;
}

const COLOR_THEMES = [
    { bg: 'bg-[#ECFEFF]/80', icon: 'bg-[#00B8DB]', border: 'border-[#E5E7EB]', glow: 'rgba(0, 184, 219, 0.15)' },
    { bg: 'bg-[#F0F5FF]/80', icon: 'bg-[#0052CC]', border: 'border-[#E5E7EB]', glow: 'rgba(0, 82, 204, 0.15)' },
    { bg: 'bg-[#FDF2F8]/80', icon: 'bg-[#DB2777]', border: 'border-[#E5E7EB]', glow: 'rgba(219, 39, 119, 0.15)' },
    { bg: 'bg-[#F0FDF4]/80', icon: 'bg-[#16A34A]', border: 'border-[#E5E7EB]', glow: 'rgba(22, 163, 74, 0.15)' },
    { bg: 'bg-[#FFF7ED]/80', icon: 'bg-[#EA580C]', border: 'border-[#E5E7EB]', glow: 'rgba(234, 88, 12, 0.15)' },
    { bg: 'bg-[#FAF5FF]/80', icon: 'bg-[#9333EA]', border: 'border-[#E5E7EB]', glow: 'rgba(147, 51, 234, 0.15)' },
    { bg: 'bg-[#FEF2F2]/80', icon: 'bg-[#DC2626]', border: 'border-[#E5E7EB]', glow: 'rgba(220, 38, 38, 0.15)' },
    { bg: 'bg-[#F5F3FF]/80', icon: 'bg-[#6D28D9]', border: 'border-[#E5E7EB]', glow: 'rgba(109, 40, 217, 0.15)' },
];

export default function RecentProjectCard({
    id,
    name,
    projectKey,
    description = "Team-managed software",
    iconText,
    type = "Team-managed software",
    boardCount = 1
}: RecentProjectCardProps) {
    const router = useRouter();
    const [isHovered, setIsHovered] = useState(false);

    // Tilt Animation Values
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const mouseXSpring = useSpring(x);
    const mouseYSpring = useSpring(y);

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseXVal = event.clientX - rect.left;
        const mouseYVal = event.clientY - rect.top;

        const xPct = mouseXVal / width - 0.5;
        const yPct = mouseYVal / height - 0.5;

        x.set(xPct);
        y.set(yPct);
        mouseX.set(mouseXVal);
        mouseY.set(mouseYVal);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
        setIsHovered(false);
    };

    const displayIconText = iconText || name.substring(0, 2).toUpperCase();
    const themeIndex = Math.abs(id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % COLOR_THEMES.length;
    const theme = COLOR_THEMES[themeIndex];

    const handleCardClick = () => {
        localStorage.setItem('currentProjectName', name);
        localStorage.setItem('currentProjectId', id);
        router.push(`/summary`);
    };

    return (
        <motion.div
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={handleMouseLeave}
            onClick={handleCardClick}
            className={`group relative w-[500px] h-[221.6px] shrink-0 ${theme.bg} backdrop-blur-md border ${theme.border} rounded-[12px] p-[24px] flex flex-col cursor-pointer transition-all duration-300 hover:shadow-lg overflow-hidden`}
        >
            {/* Dynamic Spotlight Glow */}
            <motion.div
                style={{
                    background: `radial-gradient(400px circle at ${mouseX}px ${mouseY}px, ${theme.glow}, transparent 80%)`,
                    opacity: isHovered ? 1 : 0,
                }}
                className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-0"
            />

            {/* Content Container (Layered for 3D depth) */}
            <div style={{ transform: "translateZ(50px)" }} className="relative z-10 h-full flex flex-col">
                {/* Header Section */}
                <div className="flex gap-4 items-start mb-auto">
                    {/* Project Icon */}
                    <div className={`w-12 h-12 ${theme.icon} rounded-[8px] shadow-lg flex items-center justify-center shrink-0 border border-white/20`}>
                        <span className="font-arimo text-[20px] text-white font-bold">
                            {displayIconText}
                        </span>
                    </div>

                    {/* Project Titles */}
                    <div className="flex flex-col overflow-hidden">
                        <h3 className="font-arimo text-[18px] leading-[26px] text-[#101828] font-bold truncate group-hover:text-black transition-colors">
                            {projectKey && <span className="text-[#4A5565]/60 font-medium mr-1.5">{projectKey} -</span>}
                            {name}
                        </h3>
                        <p className="font-arimo text-[14px] leading-[20px] text-[#4A5565] truncate opacity-80">
                            {type}
                        </p>
                    </div>
                </div>

                {/* Links Section */}
                <div className="flex items-center gap-6 mt-6">
                    <Link
                        href={`/summary`}
                        onClick={(e) => {
                            e.stopPropagation();
                            localStorage.setItem('currentProjectName', name);
                            localStorage.setItem('currentProjectId', id);
                        }}
                        className="font-arimo text-[14px] font-semibold text-[#0052CC] hover:underline flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/40 hover:bg-white/60 transition-all border border-black/5"
                    >
                        Summary
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5-5-5-5" /></svg>
                    </Link>

                    <span className="font-arimo text-[14px] text-[#364153]/40 cursor-not-allowed select-none">
                        Sprint backlog
                    </span>

                    <span className="font-arimo text-[14px] text-[#364153]/40 cursor-not-allowed select-none">
                        Members
                    </span>
                </div>

                {/* Footer Section */}
                <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/5">
                        <span className="font-arimo text-[13px] font-medium text-[#364153]">
                            {boardCount} {boardCount === 1 ? 'board' : 'boards'}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-60">
                            <rect x="3" y="3" width="10" height="10" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[12px] font-arimo text-[#0052CC] font-bold uppercase tracking-wider">Open Space →</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
