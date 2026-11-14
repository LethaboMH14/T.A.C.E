import { ContactForm } from '../components/ContactForm';
import { Card, Loading, Notice, PageTitle } from '../components/ui';
import { usePortal } from '../lib/ctx';

function label(x: unknown): string {
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    const v = o.name ?? o.id;
    if (typeof v === 'string') return v;
  }
  return JSON.stringify(x);
}

export function MentorHome() {
  const { me, meError, messages } = usePortal();
  if (meError) return <Notice tone="bad">{meError}</Notice>;
  if (!me) return <Loading what="your profile" />;
  const skills = Array.isArray(me.profile.mentor_skills) ? me.profile.mentor_skills : [];
  return (
    <>
      <PageTitle title={`Hi, ${me.profile.display_name}`} lead="Here are the skills you cover and how many learners you can take." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-[18px] font-bold text-ink">Your skills</h2>
          {skills.length === 0 ? (
            <p className="mt-2 text-[15px] text-ink-3">No skills are listed for this mentor in the workspace yet.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {skills.map((s, i) => (
                <li key={i} className="rounded-full border border-line bg-sunken px-3 py-1 text-[14px] font-medium text-ink-2">
                  {label(s)}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-[18px] font-bold text-ink">Capacity</h2>
          <p className="mt-2 font-mono text-[32px] font-semibold text-ink">{me.profile.capacity ?? 'not set'}</p>
          <p className="text-[14px] text-ink-3">Learners you can take on, as set in the workspace.</p>
        </Card>
        <Card className="lg:col-span-2">
          <ContactForm />
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="text-[18px] font-bold text-ink">Inbox</h2>
          <p className="mt-2 text-[15px] text-ink-2">
            {messages === null ? 'Loading…' : messages.length === 0 ? 'No messages yet.' : `${messages.filter((m) => !m.read).length} unread of ${messages.length}.`}{' '}
            <a href="#/mentor/inbox" className="font-semibold text-accent-ink hover:underline">
              Open inbox
            </a>
          </p>
        </Card>
      </div>
    </>
  );
}
