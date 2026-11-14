import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { Popover } from '@/components/ui/popover';
import { go } from '@/components/shell/route';
import { cn } from '@/lib/utils';
import {
  dismissToast, markAllRead, markRead, requestFocus, unreadCount, useNotices, type Notice, type NoticeTone,
} from '@/state/notifications';

const TONE: Record<NoticeTone, string> = {
  ok: 'bg-ok-weak text-ok',
  bad: 'bg-bad-weak text-bad',
  redo: 'bg-accent-weak text-accent-ink',
  run: 'bg-run-weak text-run',
};
const TONE_WORD: Record<NoticeTone, string> = { ok: 'Done', bad: 'Problem', redo: 'Fixed', run: 'Attention' };

/** Opens the run and the graph node a notice is about. */
export function openNotice(n: Notice): void {
  markRead(n.id);
  requestFocus({ runId: n.runId, nodeId: n.nodeId });
  go({ name: 'mission', runId: n.runId });
}

const ago = (at: number, now: number): string => {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

function Tag({ tone }: { tone: NoticeTone }) {
  return <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', TONE[tone])}>{TONE_WORD[tone]}</span>;
}

export function NotificationBell() {
  const { notices } = useNotices();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [open]);
  const unread = unreadCount(notices);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      panelClassName="w-[min(360px,calc(100vw-24px))]"
      trigger={
        <button
          type="button"
          data-popover-trigger
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-field border border-line-strong bg-surface text-ink-2 hover:bg-sunken"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden />
          {unread ? (
            <span className="mono absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      }
    >
      <div role="dialog" aria-label="Notifications">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <p className="m-0 text-[14px] font-semibold text-ink">Notifications</p>
          <button
            type="button"
            onClick={markAllRead}
            disabled={!unread}
            className="inline-flex cursor-pointer items-center gap-1 rounded-field px-2 py-1 text-[12.5px] text-ink-2 hover:bg-sunken disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            Mark all read
          </button>
        </div>
        {notices.length === 0 ? (
          <p className="m-0 px-4 py-6 text-center text-[13.5px] text-ink-3">Nothing yet. Check results, repairs and deliveries show up here.</p>
        ) : (
          <ul className="m-0 max-h-[min(420px,60vh)] list-none overflow-auto p-0">
            {notices.map((n) => (
              <li key={n.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openNotice(n);
                  }}
                  className={cn('flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-sunken', !n.read && 'bg-accent-weak/40')}
                >
                  <span className="flex items-center gap-2">
                    <Tag tone={n.tone} />
                    <span className={cn('min-w-0 flex-1 truncate text-[13.5px] text-ink', !n.read && 'font-semibold')}>{n.title}</span>
                    <span className="mono shrink-0 text-[11.5px] text-ink-3">{ago(n.at, now)}</span>
                  </span>
                  {n.detail ? <span className="line-clamp-2 text-[13px] text-ink-2">{n.detail}</span> : null}
                  <span className="mono text-[11.5px] text-ink-3">{n.runId}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Popover>
  );
}

const TOAST_MS = 7000;
const TOAST_MS_BAD = 12000;

function Toast({ n }: { n: Notice }) {
  const reduce = useReducedMotion();
  const paused = useRef(false);
  const left = useRef(n.tone === 'bad' ? TOAST_MS_BAD : TOAST_MS);

  useEffect(() => {
    const step = 250;
    const t = setInterval(() => {
      if (paused.current) return;
      left.current -= step;
      if (left.current <= 0) dismissToast(n.id);
    }, step);
    return () => clearInterval(t);
  }, [n.id]);

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
      className="pointer-events-auto flex items-start gap-2 rounded-card border border-line bg-surface p-3 shadow-lift"
    >
      <button
        type="button"
        onClick={() => {
          dismissToast(n.id);
          openNotice(n);
        }}
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 rounded-field text-left"
      >
        <span className="flex items-center gap-2">
          <Tag tone={n.tone} />
          <span className="text-[13.5px] font-semibold text-ink">{n.title}</span>
        </span>
        {n.detail ? <span className="line-clamp-3 text-[13px] text-ink-2">{n.detail}</span> : null}
      </button>
      <button
        type="button"
        onClick={() => dismissToast(n.id)}
        aria-label="Dismiss"
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-field text-ink-3 hover:bg-sunken hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </motion.li>
  );
}

/** Toasts for the key run events, on every view. Clicking one opens the run and the node it is about. */
export function Toasts() {
  const { toasts } = useNotices();
  return (
    <ul
      aria-live="polite"
      aria-label="Recent events"
      className="pointer-events-none fixed bottom-4 right-4 z-50 m-0 flex w-[min(380px,calc(100vw-32px))] list-none flex-col gap-2 p-0 max-[719px]:bottom-2 max-[719px]:right-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((n) => (
          <Toast key={n.id} n={n} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
