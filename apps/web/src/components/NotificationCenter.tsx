import React from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import type { NotificationItem } from '../types/pmam';

export function NotificationCenter({
  open,
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: {
  open: boolean;
  notifications: NotificationItem[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-zinc-900 h-full border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-14 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <h3 className="font-semibold text-sm">Bildirimler</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllRead}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tümünü okundu say
            </button>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">Henüz bildirim yok.</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.isRead && onMarkRead(n.id)}
                className={`p-4 cursor-pointer transition ${
                  n.isRead ? 'opacity-65' : 'bg-blue-50/40 dark:bg-blue-950/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold">{n.title}</span>
                  <span className="text-[10px] text-zinc-400">
                    {new Date(n.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{n.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
