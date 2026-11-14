import { useEffect, useReducer } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CircleAlert, Inbox, Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, type Mission } from '@/state';
import { ApiError, lmsApi } from '@/state/lms';
import {
  anyChannel, canConfirm, channelLine, countDrafts, deliverEligibility, deliverReducer, initialDeliver, whatHappens,
  type DeliverState,
} from './deliverState';

const DRAFTS = 'unsent-message-drafts.json';

/** Shown on a finished class run: the one approval before anything reaches a portal inbox. */
export function DeliverBar({ mission: m }: { mission: Mission }) {
  const [state, dispatch] = useReducer(deliverReducer, initialDeliver);
  const eligibility = deliverEligibility(m);

  // Opening the dialog reads two real things: the drafts file of this run, and which notice channels are connected now.
  useEffect(() => {
    if (state.phase !== 'loading' || !m.runId) return;
    let alive = true;
    const versions = m.files[DRAFTS]?.versions ?? [];
    const latest = versions[versions.length - 1];
    if (!latest) {
      dispatch({ type: 'load-failed', message: 'This run has no message drafts to deliver.' });
      return;
    }
    Promise.all([api.fileText(m.runId, latest.file), lmsApi.status()])
      .then(([text, status]) => {
        if (!alive) return;
        const n = countDrafts(text);
        if (!n) return dispatch({ type: 'load-failed', message: 'The message drafts could not be read.' });
        dispatch({ type: 'loaded', ...n, channels: { email: status.notify.email.connected, sms: status.notify.sms.connected } });
      })
      .catch((e: Error) => alive && dispatch({ type: 'load-failed', message: `Could not read the drafts or the notice channels (${e.message}).` }));
    return () => {
      alive = false;
    };
  }, [state.phase, m.runId, m.files]);

  async function confirm(s: Extract<DeliverState, { phase: 'ready' }>) {
    if (!m.runId) return;
    dispatch({ type: 'submit' });
    try {
      const result = await lmsApi.deliver(m.runId, s.notify && anyChannel(s.channels));
      dispatch({ type: 'succeeded', result });
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 409 ? e.message : (e as Error).message;
      dispatch({ type: 'failed', message: msg });
    }
  }

  if (eligibility === 'hidden') return null;

  if (eligibility === 'delivered' && m.delivered) {
    const n = m.notified;
    return (
      <section aria-label="Delivery" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-card border border-ok-line bg-ok-weak px-4 py-3 text-[14px] text-ink">
        <Badge tone="ok" data-testid="delivered-badge"><Inbox className="h-3 w-3" aria-hidden />Delivered</Badge>
        <span>
          {m.delivered.learners} learner plans and {m.delivered.mentors} mentor schedules are in the portal inboxes.
        </span>
        {n ? (
          <span className="text-ink-2">
            Notices: {n.email.sent} email and {n.sms.sent} SMS sent{n.email.failed + n.sms.failed ? `, ${n.email.failed + n.sms.failed} failed` : ''}.
          </span>
        ) : null}
      </section>
    );
  }

  const open = state.phase !== 'closed';
  const outcome = m.finished?.status === 'PARTIAL' ? `${m.finished.checksPassed} of ${m.finished.checksTotal} checks passed` : 'All checks passed';

  return (
    <>
      <section aria-label="Delivery" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card">
        <div className="min-w-0">
          <p className="m-0 text-[14.5px] font-semibold text-ink">Ready to deliver</p>
          <p className="m-0 text-[13px] text-ink-2">{outcome}. Nothing reaches a learner or mentor until you approve.</p>
        </div>
        <Button onClick={() => dispatch({ type: 'open' })}>
          <Send className="h-4 w-4" aria-hidden />
          Approve and deliver
        </Button>
      </section>

      <Dialog.Root open={open} onOpenChange={(o) => !o && dispatch({ type: 'close' })}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/20" />
          <Dialog.Content
            aria-describedby="deliver-desc"
            className="dialog-content fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-surface p-5 shadow-lift focus:outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="font-display text-[20px] font-bold tracking-[-0.01em]">
                {state.phase === 'done' ? 'Delivered' : 'Deliver to portal inboxes'}
              </Dialog.Title>
              {state.phase !== 'sending' ? (
                <Dialog.Close
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-field text-ink-2 hover:bg-sunken"
                >
                  <X className="h-4 w-4" aria-hidden />
                </Dialog.Close>
              ) : null}
            </div>

            <div id="deliver-desc" className="mt-3 text-[14px] leading-[1.5] text-ink-2">
              {state.phase === 'loading' ? (
                <p role="status" className="m-0 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
                  Reading the drafts…
                </p>
              ) : null}

              {state.phase === 'load-error' ? (
                <p role="alert" className="m-0 flex items-start gap-2 text-bad">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {state.message}
                </p>
              ) : null}

              {state.phase === 'ready' || state.phase === 'sending' ? (
                <div className="flex flex-col gap-3">
                  <p className="m-0 text-ink">{whatHappens(state.learners, state.mentors)}</p>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13.5px]">
                    <li>{channelLine('Email', state.channels.email)}</li>
                    <li>{channelLine('SMS', state.channels.sms)}</li>
                  </ul>
                  <label className={`flex items-start gap-2.5 text-[14px] ${anyChannel(state.channels) ? 'cursor-pointer text-ink' : 'cursor-not-allowed text-ink-3'}`}>
                    <input
                      type="checkbox"
                      checked={state.notify && anyChannel(state.channels)}
                      disabled={!anyChannel(state.channels) || state.phase === 'sending'}
                      onChange={() => dispatch({ type: 'toggle-notify' })}
                      className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                    />
                    <span>
                      Also send a ‘check your portal’ notice
                      {!anyChannel(state.channels) ? <span className="block text-[12.5px]">No email or SMS channel is connected.</span> : null}
                    </span>
                  </label>
                  {state.phase === 'ready' && state.error ? (
                    <p role="alert" className="m-0 flex items-start gap-2 text-bad">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      {state.error}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {state.phase === 'done' ? (
                <div role="status" className="flex flex-col gap-1.5 text-ink">
                  <p className="m-0">
                    {state.result.learners} learner plans and {state.result.mentors} mentor schedules are in the portal inboxes ({state.result.delivered} messages).
                  </p>
                  <p className="m-0 text-ink-2">{state.result.remembered} notes saved for the next plan.</p>
                  {state.notify ? <p className="m-0 text-ink-2">The ‘check your portal’ notice was sent.</p> : null}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              {state.phase === 'done' || state.phase === 'load-error' ? (
                <Button variant="outline" onClick={() => dispatch({ type: 'close' })}>{state.phase === 'done' ? 'Done' : 'Close'}</Button>
              ) : (
                <>
                  <Button variant="outline" disabled={state.phase === 'sending'} onClick={() => dispatch({ type: 'close' })}>Cancel</Button>
                  <Button disabled={!canConfirm(state)} onClick={() => state.phase === 'ready' && void confirm(state)}>
                    {state.phase === 'sending' ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : null}
                    {state.phase === 'sending' ? 'Delivering…' : 'Deliver now'}
                  </Button>
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
