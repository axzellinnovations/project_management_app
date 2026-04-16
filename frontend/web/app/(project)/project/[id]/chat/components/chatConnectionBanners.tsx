'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, WifiOff } from 'lucide-react';

interface ChatConnectionBannersProps {
  isConnected: boolean;
  shouldShowErrorBanner: boolean;
  error: string;
  onRetry: () => void;
}

export function ChatConnectionBanners({
  isConnected,
  shouldShowErrorBanner,
  error,
  onRetry,
}: ChatConnectionBannersProps) {
  return (
    <>
      <AnimatePresence>
        {!isConnected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center justify-between gap-3" role="alert">
              <div className="flex items-center gap-2 text-amber-700">
                <WifiOff size={14} strokeWidth={2.5} />
                  <span className="text-[12.5px] font-medium">Disconnected — messages may not be delivered</span>
              </div>
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg px-3 py-1 transition-colors"
              >
                <RefreshCw size={12} strokeWidth={2.5} />
                Reconnect
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shouldShowErrorBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center justify-between gap-3" role="alert">
              <div className="flex-1">
                <p className="text-[12.5px] font-semibold text-red-700">{error}</p>
                <p className="text-[11px] text-red-500 mt-0.5">Retry the connection to continue chatting.</p>
              </div>
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-red-700 hover:text-red-800 bg-red-100 hover:bg-red-200 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
              >
                <RefreshCw size={12} strokeWidth={2.5} />
                Retry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
