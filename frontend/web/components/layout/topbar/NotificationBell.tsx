'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
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

      {showDropdown && (
        <div className="absolute right-0 mt-3 w-80 bg-white/80 backdrop-blur-xl border border-white/50 shadow-2xl rounded-2xl overflow-hidden z-50 transform origin-top-right transition-all duration-300 ease-out">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100/50 bg-white/50">
            <span className="font-semibold text-cu-text-primary text-sm">Notifications</span>
            <button onClick={markAllAsRead} className="text-xs font-medium text-cu-primary hover:text-cu-primary-dark transition">Mark all as read</button>
          </div>
          <div className="max-h-[320px] overflow-y-auto no-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-cu-text-muted text-sm">You have no notifications</div>
            ) : (
              notifications.map((notif) => (
                <Link
                  href={notif.link || '#'}
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`block p-4 border-b last:border-0 border-gray-50 hover:bg-white/60 transition-colors ${!notif.read ? 'bg-cu-primary/5' : ''}`}
                >
                  <div className="flex gap-3">
                    <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${!notif.read ? 'bg-cu-primary' : 'bg-transparent'}`} />
                    <div>
                      <p className={`text-sm ${!notif.read ? 'text-cu-text-primary font-medium' : 'text-cu-text-secondary'}`}>
                        {notif.message}
                      </p>
                      <span className="text-xs text-cu-text-muted mt-1 block">
                        {new Date(notif.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
