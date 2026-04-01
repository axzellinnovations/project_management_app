'use client';
import { useEffect, useState } from 'react';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Returns responsive helpers derived from the current viewport width.
 * Consistent breakpoints across the entire app — prevents layout jumps
 * caused by each page independently tracking window width.
 */
export function useBreakpoint() {
    const [width, setWidth] = useState<number>(
        typeof window !== 'undefined' ? window.innerWidth : 1280
    );

    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile  = width < 768;
    const isTablet  = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;

    const breakpoint: Breakpoint =
        width < 640  ? 'xs'  :
        width < 768  ? 'sm'  :
        width < 1024 ? 'md'  :
        width < 1280 ? 'lg'  :
        width < 1536 ? 'xl'  : '2xl';

    return { breakpoint, isMobile, isTablet, isDesktop, width };
}
