'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function CoffeeLoader() {
    const [phase, setPhase] = useState<'filling' | 'morphing' | 'check'>('filling');

    useEffect(() => {
        let isMounted = true;
        const loop = async () => {
            while (isMounted) {
                setPhase('filling');
                await new Promise(r => setTimeout(r, 2200)); // filling
                if (!isMounted) break;
                setPhase('morphing');
                await new Promise(r => setTimeout(r, 400)); // morphing
                if (!isMounted) break;
                setPhase('check');
                await new Promise(r => setTimeout(r, 1400)); // check hold
            }
        };
        loop();
        return () => { isMounted = false; };
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] w-full gap-5">
            <div className="relative flex items-center justify-center w-24 h-24">
                
                {/* Stage 1: Coffee Mug & Liquid */}
                <motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={
                        phase === 'filling' ? { scale: 1, opacity: 1 } :
                        phase === 'morphing' ? { scale: 0.8, opacity: 0 } :
                        { scale: 0.8, opacity: 0 }
                    }
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="absolute inset-0 flex items-center justify-center"
                >
                    <svg viewBox="0 0 100 100" className="w-[72px] h-[72px] overflow-visible">
                        {/* Empty Mug Body Outline (Neutral Gray) */}
                        <path 
                            d="M 30 20 L 30 75 C 30 85 35 90 45 90 L 55 90 C 65 90 70 85 70 75 L 70 20 Z" 
                            fill="none" 
                            stroke="#9CA3AF" 
                            strokeWidth="4" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                        />
                        
                        {/* Mug Handle (Neutral Gray) */}
                        <path 
                            d="M 70 35 C 85 35 85 65 70 65" 
                            fill="none" 
                            stroke="#9CA3AF" 
                            strokeWidth="4" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                        />
                        
                        {/* Liquid Fill Mask bounds */}
                        <clipPath id="mugClip">
                            <path d="M 32 22 L 32 75 C 32 84 36 88 45 88 L 55 88 C 64 88 68 84 68 75 L 68 22 Z" />
                        </clipPath>

                        {/* Liquid Filling Up (Primary Accent - Jira Blue) */}
                        <g clipPath="url(#mugClip)">
                            <motion.rect 
                                x="30" y="20" width="40" height="70" fill="#0052CC"
                                initial={{ scaleY: 0 }}
                                animate={phase === 'filling' ? { scaleY: 1 } : { scaleY: 1 }}
                                style={{ originY: 1 }}
                                transition={{ duration: 2, ease: [0.4, 0, 0.2, 1] }} 
                            />
                            {/* Gentle surface pulse width/opacity */}
                            <motion.ellipse 
                                cx="50" cy="22" rx="18" ry="2" fill="#2684FF"
                                initial={{ opacity: 0 }}
                                animate={phase === 'filling' ? { 
                                    opacity: [0, 0, 0.8, 1], 
                                    scaleX: [0.5, 0.6, 1, 1.05, 1] 
                                } : { opacity: 0 }}
                                transition={{ duration: 2, ease: "easeInOut" }}
                            />
                        </g>

                        {/* Coffee Droplets falling into the mug */}
                        {phase === 'filling' && [0, 1, 2].map(i => (
                            <motion.path
                                key={i}
                                d="M 50 0 C 52 5 53 8 50 12 C 47 8 48 5 50 0"
                                fill="#0052CC"
                                initial={{ y: -15, opacity: 0, scale: 0.5 }}
                                animate={{ y: 25, opacity: [0, 1, 0], scale: 1 }}
                                transition={{ 
                                    repeat: Infinity, 
                                    delay: i * 0.6, 
                                    duration: 0.65,
                                    ease: "easeIn" 
                                }}
                            />
                        ))}
                    </svg>
                </motion.div>

                {/* Stage 2: Final Transformation Checkmark (Jira Blue) */}
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={
                        phase === 'morphing' ? { scale: [0, 1.2], opacity: 1 } :
                        phase === 'check' ? { scale: 1, opacity: 1 } :
                        { scale: 0, opacity: 0 }
                    }
                    transition={{ duration: 0.4, ease: "backOut" }}
                    className="absolute inset-0 flex items-center justify-center"
                >
                    <svg viewBox="0 0 100 100" className="w-[60px] h-[60px] overflow-visible">
                        {/* A sharply drawn bold checkmark */}
                         <motion.path 
                            d="M 20 50 L 40 70 L 80 25" 
                            fill="none" 
                            stroke="#0052CC" 
                            strokeWidth="8" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: (phase === 'morphing' || phase === 'check') ? 1 : 0 }}
                            transition={{ duration: 0.3, delay: phase === 'morphing' ? 0.1 : 0, ease: "easeOut" }}
                        />
                    </svg>
                </motion.div>
            </div>
            
            <div className="h-6 overflow-hidden flex flex-col items-center">
                <motion.span 
                    key={phase}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="text-[#6A7282] font-arimo text-[14px] font-medium tracking-wide"
                >
                    {phase === 'filling' ? 'Converting coffee to tasks...' : 'System Ready'}
                </motion.span>
            </div>
        </div>
    );
}
