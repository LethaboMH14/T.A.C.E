import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import NumberFlow from '@number-flow/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CircleAlert, Copy, Check, LifeBuoy, Loader2, PanelLeftClose, PanelLeftOpen, Play, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QrCode } from '@/components/live/QrCode';
import { go } from '@/components/shell/route';
import { cn } from '@/lib/utils';
import {
  byLearnerView, bySkillView, itemKey, learnerLabel, needsHelpView, timelineView,
  type AttemptItem, type HelpItem, type LiveItem, type LiveState,
} from '@/state/live';
import { ApiError, lmsApi, type StatusState } from '@/state/lms';

export type LiveTab = 'help' | 'learner' | 'skill' | 'timeline';
const PAGE = 200;

const clock = (at: string | null): string => {
  const t = at ? Date.parse(at) : NaN;
  return Number.isNaN(t) ? '' : new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
const words = (s: string | null): string => (s ?? '').replace(/_/g, ' ');

// ------------------------------------------------------------------ join card

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0 flex-1 rounded-field bg-sunken px-3 py-2">
      <div className="mono text-[22px] font-semibold leading-tight text-ink">
        {value === null ? '–' : <NumberFlow value={value} respectMotionPreference />}
      </div>
      <div className="truncate text-[12.5px] text-ink-2">{label}</div>
    </div>
  );
}

function JoinCard({ portalUrl, counts }: { portalUrl: string | null; counts: { claimed: number | null; attempts: number | null; help: number | null } }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard refused: the link text is still selectable */
    }
  };
  const short = portalUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? null;
  return (
    <section aria-labelledby="h-join" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
      <h2 id="h-join" className="text-[15px] font-semibold text-ink">Join the class</h2>
      {portalUrl && short ? (
        <div className="flex items-center gap-3 max-[420px]:flex-col max-[420px]:items-start">
          <QrCode value={portalUrl} label={`QR code for ${short}`} size={152} />
          <div className="flex min-w-0 flex-col items-start gap-2">
            <a href={portalUrl} target="_blank" rel="noreferrer" className="mono break-all text-[13.5px] text-accent-ink hover:underline">{short}</a>
            <Button variant="outline" onClick={copy} className="h-8 px-3 text-[13px]">
              {copied ? <Check className="h-3.5 w-3.5 text-ok" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      ) : (
        <div role="status" className="rounded-field border border-dashed border-line-strong px-3 py-4 text-[13.5px] text-ink-2">
          <p className="m-0 font-semibold text-ink">Portal link not set</p>
          <p className="m-0 mt-0.5">The server has no public portal address, so there is no QR code to show.</p>
        </div>
      )}
      <div className="flex gap-2" aria-label="Class totals">
        <Stat label="Joined" value={counts.claimed} />
        <Stat label="Submissions" value={counts.attempts} />
        <Stat label="Help requests" value={counts.help} />
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ plan composer

function PlanComposer() {
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { runId } = await lmsApi.run(goal);
      go({ name: 'mission', runId });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError(e.message || 'A plan is already running. Wait for it to finish.');
      else if (e instanceof ApiError && e.status === 503) setError(e.message || 'The portal is not connected on the server.');
      else setError((e as Error).message || 'The plan could not be started.');
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="h-plan" className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4 shadow-card">
      <h2 id="h-plan" className="text-[15px] font-semibold text-ink">Plan for this class</h2>
      <label htmlFor="plan-goal" className="sr-only">Goal for this plan (optional)</label>
      <textarea
        id="plan-goal"
        value={goal}
        maxLength={500}
        rows={3}
        disabled={busy}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Goal (optional)"
        className="w-full resize-y rounded-field border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="mono text-[12px] text-ink-3" aria-live="off">{goal.length}/500</span>
        <Button onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
          {busy ? 'Starting…' : 'Run plan'}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="m-0 flex items-start gap-2 text-[13.5px] leading-[1.45] text-bad">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </section>
  );
}

// ------------------------------------------------------------------ feed

// Keys of items already on screen. A row animates in only if it was not shown before.
const ShownContext = createContext<Set<string>>(new Set());

function ItemRow({ item }: { item: LiveItem }) {
  const reduce = useReducedMotion();
  const shown = useContext(ShownContext);
  const key = itemKey(item);
  const [fresh] = useState(() => !shown.has(key));
  useEffect(() => {
    shown.add(key);
  }, [shown, key]);
  const isHelp = item.type === 'help';
  return (
    <motion.li
      layout={false}
      initial={fresh && !reduce ? { opacity: 0, y: -6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      data-type={item.type}
      className="flex items-start gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
    >
      <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', isHelp ? 'bg-run-weak text-run' : 'bg-sunken text-ink-2')}>
        {isHelp ? <LifeBuoy className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-[14px]">
          <span className="font-semibold text-ink">{learnerLabel(item)}</span>
          {item.learner && item.name ? <span className="mono text-[12px] text-ink-3">{item.learner}</span> : null}
          {item.skill ? <span className="mono text-[12px] text-ink-2">{item.skill}</span> : null}
          <span className="mono ml-auto text-[12px] text-ink-3">{clock(item.at)}</span>
        </p>
        {isHelp ? (
          <p className="m-0 mt-0.5 text-[13.5px] leading-[1.45] text-ink-2">
            <Badge tone="run" className="mr-1.5">Help · {words((item as HelpItem).category) || 'other'}</Badge>
            {(item as HelpItem).text}
          </p>
        ) : (
          <p className="m-0 mt-0.5 text-[13.5px] text-ink-2">
            Scored <span className="mono font-semibold text-ink">{(item as AttemptItem).score ?? '–'}</span>
            {(item as AttemptItem).source ? <span className="text-ink-3"> · {words((item as AttemptItem).source)}</span> : null}
          </p>
        )}
      </div>
    </motion.li>
  );
}

function ItemList({ items, limit }: { items: LiveItem[]; limit: number }) {
  return (
    <ul className="m-0 list-none p-0">
      <AnimatePresence initial={false}>
        {items.slice(0, limit).map((i) => (
          <ItemRow key={itemKey(i)} item={i} />
        ))}
      </AnimatePresence>
    </ul>
  );
}

function Group({ title, sub, badges, open, onToggle, children }: { title: string; sub?: string; badges: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left hover:bg-sunken">
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
          {title}
          {sub ? <span className="mono ml-2 text-[12px] font-normal text-ink-3">{sub}</span> : null}
        </span>
        {badges}
      </button>
      {open ? <div className="bg-bg">{children}</div> : null}
    </div>
  );
}

function SectionTitle({ children, count }: { children: string; count: number }) {
  return (
    <h3 className="sticky top-0 z-10 m-0 flex items-center gap-2 border-b border-line bg-sunken px-3 py-1.5 text-[12.5px] font-semibold text-ink-2">
      {children}
      <span className="mono font-normal text-ink-3">{count}</span>
    </h3>
  );
}

function Feed({ live }: { live: LiveState }) {
  const [tab, setTab] = useState<LiveTab>('help');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [limit, setLimit] = useState(PAGE);
  // Items present when the feed first rendered are not animated.
  const shown = useRef<Set<string> | null>(null);
  if (shown.current === null) shown.current = new Set(live.items.map(itemKey));
  const items = live.items;
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const helpCount = items.filter((i) => i.type === 'help').length;

  let body: ReactNode;
  if (tab === 'help') {
    const v = needsHelpView(items);
    body = (
      <>
        <SectionTitle count={v.help.length}>Help requests</SectionTitle>
        {v.help.length ? <ItemList items={v.help} limit={limit} /> : <p className="m-0 px-3 py-3 text-[13.5px] text-ink-3">No help requests yet.</p>}
        <SectionTitle count={v.submissions.length}>Submissions</SectionTitle>
        {v.submissions.length ? <ItemList items={v.submissions} limit={limit} /> : <p className="m-0 px-3 py-3 text-[13.5px] text-ink-3">No submissions yet.</p>}
      </>
    );
  } else if (tab === 'learner') {
    body = byLearnerView(items).map((g) => (
      <Group
        key={g.learner}
        title={g.label}
        sub={g.learner.startsWith('~') ? undefined : g.learner}
        open={!!open[`l:${g.learner}`]}
        onToggle={() => toggle(`l:${g.learner}`)}
        badges={
          <span className="flex shrink-0 items-center gap-1.5">
            {g.help ? <Badge tone="run">{g.help} help</Badge> : null}
            <Badge>{g.submissions} submitted</Badge>
            {g.latest && g.latest.score !== null ? <Badge tone="plain">latest {g.latest.score}</Badge> : null}
          </span>
        }
      >
        <ItemList items={g.items} limit={limit} />
      </Group>
    ));
  } else if (tab === 'skill') {
    body = bySkillView(items, null).map((g) => (
      <Group
        key={g.skill || '~none'}
        title={g.skill || 'No skill'}
        open={!!open[`s:${g.skill}`]}
        onToggle={() => toggle(`s:${g.skill}`)}
        badges={
          <span className="flex shrink-0 items-center gap-1.5">
            {g.help ? <Badge tone="run">{g.help} help</Badge> : null}
            <Badge>{g.submissions} submitted</Badge>
          </span>
        }
      >
        <ItemList items={g.items} limit={limit} />
      </Group>
    ));
  } else {
    body = <ItemList items={timelineView(items)} limit={limit} />;
  }

  return (
    <section aria-labelledby="h-feed" className="flex min-h-0 min-w-0 flex-1 flex-col rounded-card border border-line bg-surface shadow-card">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <h2 id="h-feed" className="text-[15px] font-semibold text-ink">Live feed</h2>
        <Tabs value={tab} onValueChange={(v) => setTab(v as LiveTab)}>
          <TabsList aria-label="Group the feed by">
            <TabsTrigger value="help">Needs help{helpCount ? <span className="mono text-[11.5px]">{helpCount}</span> : null}</TabsTrigger>
            <TabsTrigger value="learner">By learner</TabsTrigger>
            <TabsTrigger value="skill">By skill</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {live.connection === 'reconnecting' ? (
        <p role="status" className="m-0 flex shrink-0 items-center gap-2 border-b border-line bg-sunken px-3 py-1.5 text-[12.5px] text-ink-2">
          <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
          Reconnecting…
        </p>
      ) : null}
      {live.serverError ? (
        <p role="alert" className="m-0 flex shrink-0 items-start gap-2 border-b border-bad-line bg-bad-weak px-3 py-2 text-[13px] text-bad">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          The portal reported a problem: {live.serverError}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto" tabIndex={0} aria-label="Feed items">
        {items.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-1 p-6 text-center">
            {live.connection === 'connecting' ? (
              <p role="status" className="m-0 flex items-center gap-2 text-[14px] text-ink-2"><Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />Connecting to the class…</p>
            ) : (
              <>
                <p className="m-0 text-[15px] font-semibold text-ink">No activity yet</p>
                <p className="m-0 text-[13.5px] text-ink-2">Submissions and help requests appear here as learners send them.</p>
              </>
            )}
          </div>
        ) : (
          <ShownContext.Provider value={shown.current}>
            {body}
            {items.length > limit ? (
              <div className="p-3 text-center">
                <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>Show more ({items.length - limit} older)</Button>
              </div>
            ) : null}
          </ShownContext.Provider>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ view

export function LiveView({ status, onRetry, live, feedAvailable }: { status: StatusState; onRetry: () => void; live: LiveState; feedAvailable: boolean }) {
  const [panel, setPanel] = useState(true);

  if (status.kind === 'loading') {
    return (
      <div role="status" className="flex flex-1 items-center justify-center gap-2 p-8 text-[14px] text-ink-2">
        <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
        Reading the class portal…
      </div>
    );
  }
  if (status.kind === 'error' || (status.kind === 'ready' && status.status.error)) {
    const message = status.kind === 'error' ? status.message : (status.kind === 'ready' ? status.status.error : '') ?? '';
    return (
      <Problem icon={<WifiOff className="h-5 w-5" aria-hidden />} title="Class portal unreachable" detail={message} onRetry={onRetry} />
    );
  }
  if (status.kind === 'ready' && !status.status.configured) {
    return <Problem icon={<WifiOff className="h-5 w-5" aria-hidden />} title="Class portal not connected" detail="The server has no portal connection, so there is no class to show." onRetry={onRetry} />;
  }

  const s = status.kind === 'ready' ? status.status : null;
  const counts = {
    claimed: live.counts?.claimed ?? s?.counts?.claimed ?? null,
    attempts: live.counts?.attempts ?? s?.counts?.attempts_live ?? null,
    help: live.counts?.help ?? s?.counts?.help ?? null,
  };

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4 max-[899px]:flex-col max-[899px]:overflow-auto">
      {panel ? (
        <aside aria-label="Join and plan" className="flex w-[340px] shrink-0 flex-col gap-4 overflow-auto max-[899px]:w-full max-[899px]:overflow-visible">
          <JoinCard portalUrl={s?.portalUrl ?? null} counts={counts} />
          <PlanComposer />
        </aside>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 max-[899px]:min-h-[420px]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-[22px] font-bold tracking-[-0.01em] text-ink">Live class</h1>
          <button
            type="button"
            onClick={() => setPanel((p) => !p)}
            aria-pressed={!panel}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-field border border-line-strong bg-surface px-2.5 text-[13px] text-ink-2 hover:bg-sunken max-[899px]:hidden"
          >
            {panel ? <PanelLeftClose className="h-4 w-4" aria-hidden /> : <PanelLeftOpen className="h-4 w-4" aria-hidden />}
            {panel ? 'Hide join panel' : 'Show join panel'}
          </button>
        </div>
        {feedAvailable ? (
          <Feed live={live} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-card border border-line bg-surface p-6 text-center shadow-card">
            <p className="m-0 text-[15px] font-semibold text-ink">Live feed unavailable</p>
            <p className="m-0 text-[13.5px] text-ink-2">The server has no portal admin access, so submissions cannot be streamed.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Problem({ icon, title, detail, onRetry }: { icon: ReactNode; title: string; detail: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div role="alert" className="flex max-w-[440px] flex-col items-start gap-3 rounded-card border border-line bg-surface p-5 shadow-card">
        <p className="m-0 flex items-center gap-2 text-[15px] font-semibold text-ink">{icon}{title}</p>
        {detail ? <p className="m-0 text-[14px] text-ink-2">{detail}</p> : null}
        <Button variant="outline" onClick={onRetry}><RefreshCw className="h-4 w-4" aria-hidden />Try again</Button>
      </div>
    </div>
  );
}
