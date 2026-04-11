'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface WelcomeGreetingProps {
    username: string;
}

export default function WelcomeGreeting({ username }: WelcomeGreetingProps) {
    const [timeData, setTimeData] = useState<{ period: 'morning' | 'afternoon' | 'evening'; text: string } | null>(null);

    useEffect(() => {
        const hour = new Date().getHours();
        const capitalizedName = username.charAt(0).toUpperCase() + username.slice(1);
        
        const timer = setTimeout(() => {
            if (hour >= 0 && hour < 12) {
                setTimeData({ period: 'morning', text: `Good Morning, ${capitalizedName}!` });
            } else if (hour >= 12 && hour < 17) {
                setTimeData({ period: 'afternoon', text: `Good Afternoon, ${capitalizedName}!` });
            } else {
                setTimeData({ period: 'evening', text: `Good Evening, ${capitalizedName}!` });
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [username]);

    if (!timeData) return <h1 className="font-arimo text-[16px] xl:text-[20px] leading-[24px] text-transparent font-semibold invisible">Loading</h1>;

    const renderIcon = () => {
        switch (timeData.period) {
            case 'morning':
                return (
                    <motion.div
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: [0.7, 1.1, 1.0], opacity: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="relative flex items-center justify-center text-[#F59E0B] w-[24px] h-[24px] shrink-0"
                    >
                        <motion.svg
                            animate={{ rotate: 360 }}
                            transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                            width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </motion.svg>
                    </motion.div>
                );
            case 'afternoon':
                return (
                    <motion.div
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="relative flex items-center justify-center text-[#F59E0B] w-[24px] h-[24px] shrink-0"
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute -left-0.5 -top-0.5 opacity-90">
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                        <motion.svg
                            animate={{ x: [2, -2, 2] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                            width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            className="absolute -right-2 top-2 z-10 drop-shadow-sm"
                        >
                            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                        </motion.svg>
                    </motion.div>
                );
            case 'evening':
                return (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8 }}
                        className="relative flex items-center justify-center text-[#818CF8] w-[24px] h-[24px] shrink-0"
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                        <motion.svg
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                            width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none"
                            className="absolute -top-1 -right-0.5 text-[#FCD34D]"
                        >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </motion.svg>
                        <motion.svg
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                            width="6" height="6" viewBox="0 0 24 24" fill="currentColor" stroke="none"
                            className="absolute top-2 -left-1 text-[#FCD34D]"
                        >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </motion.svg>
                    </motion.div>
                );
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex items-center gap-2 sm:gap-2.5 min-w-0"
        >
            <div className="flex-shrink-0 flex items-center justify-center">
                {renderIcon()}
            </div>
            <h1 className="font-outfit text-[16px] sm:text-[19px] xl:text-[21px] leading-tight text-[#101828] font-bold tracking-tight truncate">
                {timeData.text}
            </h1>
        </motion.div>
    );
}
