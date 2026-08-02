'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Inbox, X } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { fetchNotifications, markNotificationsRead } from '@/lib/api';

function timeLabel(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell({ role }) {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      const data = await fetchNotifications({ limit: 30 }, role);
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount) || 0);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Notifications are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchNotifications({ limit: 30 }, role)
      .then((data) => {
        if (cancelled) return;
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(Number(data.unreadCount) || 0);
        setError('');
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || 'Notifications are temporarily unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const interval = window.setInterval(() => { void refresh(); }, 45000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
    // Role changes in demo mode represent a different workspace and should
    // reload the same account's role-scoped inbox immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const markReadAndOpen = async (notification) => {
    if (!notification.readAt) {
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
      )));
      setUnreadCount((count) => Math.max(0, count - 1));
      await markNotificationsRead({ notificationId: notification.id }, role).catch(() => {});
    }
    setOpen(false);
    if (notification.href && notification.href !== pathname) router.push(notification.href);
  };

  const markAllRead = async () => {
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    await markNotificationsRead({ markAllRead: true }, role).catch(() => {});
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-muted transition hover:bg-black/[0.04] hover:text-[#1d1d1f]"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-crimson px-1 text-center text-[10px] font-bold leading-5 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Notifications"
          className="surface absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden border border-black/10 p-0 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-black/10 px-4 py-3">
            <div>
              <h2 className="font-heading text-sm font-bold">Notifications</h2>
              <p className="mt-0.5 text-[11px] text-muted">Updates about the things you are involved in.</p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} className="rounded-lg p-2 text-muted hover:bg-black/[0.04]" title="Mark all as read">
                  <CheckCheck className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Mark all as read</span>
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted hover:bg-black/[0.04]" aria-label="Close notifications">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="max-h-[min(65vh,480px)] overflow-y-auto">
            {loading ? <p className="px-4 py-8 text-center text-sm text-muted">Loading your updates…</p> : null}
            {!loading && error ? <p className="px-4 py-6 text-center text-xs text-amber-800">{error}</p> : null}
            {!loading && !error && notifications.length === 0 ? (
              <div className="px-5 py-9 text-center">
                <Inbox className="mx-auto h-7 w-7 text-muted" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold">You are all caught up</p>
                <p className="mt-1 text-xs text-muted">When you register, are assigned, or need to act, the update will appear here.</p>
              </div>
            ) : null}
            {!loading && !error && notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => { void markReadAndOpen(notification); }}
                className={`flex w-full items-start gap-3 border-b border-black/[0.06] px-4 py-3 text-left transition hover:bg-black/[0.03] ${notification.readAt ? '' : 'bg-crimson/[0.035]'}`}
              >
                <Avatar name={notification.actor?.name ?? 'QIU'} src={notification.actor?.avatarUrl} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-[#1d1d1f]">{notification.title}</span>
                    {!notification.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-crimson" aria-label="Unread" />}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">{notification.body}</span>
                  <span className="mt-1.5 block text-[10px] font-semibold text-muted">{timeLabel(notification.createdAt)} · {notification.emailStatus === 'QUEUED' ? 'Email queued' : 'In portal'}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

