'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalNotifications } from '@/components/providers/GlobalNotificationProvider';

export function NotificationBell() {
  const [showDropdown, setShowDropdown] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useGlobalNotifications();

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-full hover:bg-black/5 transition-colors"
      >
        <Bell size={20} className="text-cu-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-cu-danger text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden z-50 origin-top-right transition-all"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white/50">
              <span className="font-bold text-slate-900 text-[14px] font-outfit">Notifications</span>
              <button 
                onClick={markAllAsRead} 
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition font-outfit uppercase tracking-wider"
              >
                Mark all as read
              </button>
            </div>
            <div className="max-h-[320px] overflow-y-auto no-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm italic">You have no notifications</div>
              ) : (
                notifications.map((notif) => (
                  <Link
                    href={notif.link || '#'}
                    key={notif.id}
                    onClick={() => {
                        markAsRead(notif.id);
                        setShowDropdown(false);
                    }}
                    className={`block p-4 border-b last:border-0 border-slate-50 hover:bg-slate-50 transition-colors ${!notif.read ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${!notif.read ? 'bg-blue-600' : 'bg-transparent'}`} />
                      <div>
                        <p className={`text-[13px] leading-relaxed ${!notif.read ? 'text-slate-900 font-bold' : 'text-slate-600 font-medium'} font-outfit`}>
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-1.5 block font-bold uppercase tracking-wider font-outfit">
                          {new Date(notif.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
