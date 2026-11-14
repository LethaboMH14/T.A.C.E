import { InboxList } from '../components/InboxList';
import { Empty, Loading, NextStep, Notice, PageTitle } from '../components/ui';
import { usePortal } from '../lib/ctx';

// Used by learners and mentors. Polls every 4 s (see Portal).
export function InboxPage() {
  const { kind, messages, inboxError, markRead } = usePortal();
  return (
    <>
      <PageTitle
        title="Inbox"
        lead={
          kind === 'learner'
            ? 'Your study plans and session times from your coordinator. Tap a message to read it. You can also have it read aloud.'
            : 'Your session list from your coordinator. Tap a message to read it.'
        }
      />
      {inboxError && <div className="mb-4"><Notice tone="bad">{inboxError}</Notice></div>}
      {!messages && !inboxError && <Loading what="inbox" />}
      {messages && messages.length === 0 && (
        <Empty title="No messages yet.">
          {kind === 'learner'
            ? 'Plans and session times appear here after the coordinator approves them.'
            : 'Session times appear here after the coordinator confirms them.'}
        </Empty>
      )}
      {messages && messages.length > 0 && <InboxList messages={messages} onOpen={(m) => !m.read && void markRead(m.id)} />}
      {kind === 'learner' ? (
        <NextStep href="#/learner/skills" label="See my skills">
          Pick a skill and take its short quiz. Your coordinator uses the results to plan your next steps.
        </NextStep>
      ) : (
        <NextStep href="#/mentor/availability" label="Set my hours">
          Make sure your hours are up to date, so the coordinator can book sessions with you.
        </NextStep>
      )}
    </>
  );
}
