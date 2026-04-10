'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    /** 'half' ≈ 50vh, 'full' ≈ 90vh, 'auto' = content height (default) */
    snapPoint?: 'half' | 'full' | 'auto';
    children: React.ReactNode;
    /** Hide the X button — useful for confirmation-only sheets */
    hideCloseButton?: boolean;
}

export default function BottomSheet({
    isOpen,
    onClose,
    title,
    snapPoint = 'auto',
    children,
    hideCloseButton = false,
}: BottomSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // Prevent body scroll while sheet is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const maxHeightClass =
        snapPoint === 'full' ? 'max-h-[90vh]' :
        snapPoint === 'half' ? 'max-h-[55vh]' :
        'max-h-[92vh]';

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[150] bg-black/45"
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    {/* Sheet */}
                    <motion.div
                        key="sheet"
                        ref={sheetRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={title}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.8 }}
                        drag="y"
                        dragConstraints={{ top: 0 }}
                        dragElastic={{ top: 0, bottom: 0.3 }}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 80 || info.velocity.y > 500) onClose();
                        }}
                        className={`fixed bottom-0 inset-x-0 z-[151] bg-white rounded-t-[24px] flex flex-col ${maxHeightClass} overflow-hidden`}
                        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                    >
                        {/* Drag handle */}
                        <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
                            <div className="w-9 h-[5px] rounded-full bg-[#D1D5DB]" />
                        </div>

                        {/* Header */}
                        {(title || !hideCloseButton) && (
                            <div className="flex items-center justify-between px-5 py-3 border-b border-[#F3F4F6] shrink-0">
                                {title ? (
                                    <span className="text-[15px] font-semibold text-[#101828]">{title}</span>
                                ) : (
                                    <span />
                                )}
                                {!hideCloseButton && (
                                    <button
                                        onClick={onClose}
                                        className="p-1.5 rounded-full hover:bg-[#F3F4F6] transition-colors text-[#6A7282]"
                                        aria-label="Close"
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
