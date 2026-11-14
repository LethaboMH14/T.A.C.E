// Plain-English story of a run. Pure function: Mission state -> chapters.
// Every sentence is backed by a ledger event already folded into Mission.events. A missing event means a missing sentence.

import { summarySentence } from './mission';
import type { LedgerEvent, Mission, Task } from './types';

export type ChapterStatus = 'idle' | 'active' | 'done' | 'bad';
export type LineTone = '' | 'ok' | 'bad' | 'redo';
export type ChapterIcon = 'goal' | 'sources' | 'plan' | 'work' | 'review';

export interface StoryLine {
  id: string;
  text: string;
  tone: LineTone;
  /** Raw ids behind the plain words, shown on hover for experts. */
  title?: string;
  /** Graph node to focus when the line is clicked. */
  nodeId?: string;
  /** A small group label such as "First". Not clickable. */
  heading?: boolean;
}

export interface StoryChapter {
  n: number;
  id: string;
  title: string;
  icon: ChapterIcon;
  status: ChapterStatus;
  lines: StoryLine[];
  /** Shown while the chapter has no lines yet. */
  waiting: string;
}

const WORDS: Record<string, string> = {
  'mentor-schedule.csv': 'mentor schedule',
  'mentor_schedule': 'mentor schedule',
  'unsent-message-drafts': 'message drafts',
  'message_drafts': 'message drafts',
  'gap-analysis.csv': 'gap analysis',
  'gap_analysis': 'gap analysis',
  'gaps.json': 'list of skill gaps',
  'gaps': 'list of skill gaps',
  'improvement-plan': 'support plan',
  'improvement_plan': 'support plan',
  'performance-summary': 'performance summary',
  'performance_summary': 'performance summary',
  'assessments.csv': 'assessment scores',
  'rerun_producer': 're-ran that step',
  'shift_one_hour': 'tried moving the session one hour later',
  'first_free_valid_slot': 'moved it to the first free slot that fits',
  'reschedule_affected_sessions': 'moved only the sessions that break a rule',
  'recompute_affected_numbers': 'recomputed only the wrong numbers from the raw scores',
  'regenerate_from_latest_schedule': 'rewrote the drafts from the latest schedule',
};

/** Plain words for a technical id or file name. Unknown ids lose their extension and separators. */
export function plain(id: string): string {
  const key = id.replace(/@v\d+$/, '');
  if (WORDS[key]) return WORDS[key]!;
  const noExt = key.replace(/\.[a-z0-9]{2,4}$/i, '');
  if (WORDS[noExt]) return WORDS[noExt]!;
  return noExt.replace(/[-_]+/g, ' ');
}

/** "mentor-schedule.csv@v2" -> "mentor schedule (version 2)". */
export function plainArtifact(ref: string): string {
  const v = /@v(\d+)$/.exec(ref)?.[1];
  return v && v !== '1' ? `${plain(ref)} (version ${v})` : plain(ref);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const learner = (id: string) => `Learner ${id.replace(/^L-?/, '')}`;

/** One repair change in words. Only fields the ledger carried are used. */
export function describeChange(c: any): string | null {
  if (!c || typeof c !== 'object') return null;
  const from = typeof c.from === 'string' ? c.from : null;
  const to = typeof c.to === 'string' ? c.to : null;
  if (from !== null && to !== null) {
    // "M-B Tue 09:00" -> "Tue 09:00" when the mentor stays the same.
    const [fm, ...fr] = from.split(' ');
    const [tm, ...tr] = to.split(' ');
    const same = fm === tm && fr.length > 0 && tr.length > 0;
    const a = same ? fr.join(' ') : from;
    const b = same ? tr.join(' ') : to;
    if (typeof c.trainee_id === 'string') return `moved ${learner(c.trainee_id)}'s session from ${a} to ${b}`;
    if (typeof c.session_id === 'string') return `moved session ${c.session_id} from ${a} to ${b}`;
    return `changed ${typeof c.field === 'string' ? plain(c.field) : 'a value'} from ${a} to ${b}`;
  }
  return typeof c.reason === 'string' ? c.reason : null;
}

const ev = (events: LedgerEvent[], type: string) => events.filter((e) => e.type === type);

function depth(t: Task, byId: Map<string, Task>, seen = new Set<string>()): number {
  if (!t.dependsOn.length || seen.has(t.id)) return 0;
  seen.add(t.id);
  return 1 + Math.max(...t.dependsOn.map((d) => (byId.get(d) ? depth(byId.get(d)!, byId, seen) : 0)));
}

export function buildStory(m: Mission): StoryChapter[] {
  const events = m.events;
  const roleOf = (taskId: string | null | undefined) => m.tasks.find((t) => t.id === taskId)?.role ?? (taskId ? plain(taskId) : '');

  // ---- 1. What you asked
  const c1: StoryLine[] = [];
  if (m.goalText) c1.push({ id: 'goal', text: `You asked: “${m.goalText}”`, tone: '', nodeId: 'goal' });
  for (const g of m.goalDrafts) {
    if (!g.ok) c1.push({ id: `draft-${g.attempt}`, text: `My reading of the goal (attempt ${g.attempt}) was not accepted, so I tried again.`, tone: 'redo', title: g.code ?? undefined, nodeId: 'goal' });
  }
  if (m.deliverables.length) {
    const names = m.deliverables.map(plain).join(', ');
    c1.push({ id: 'deliverables', text: `I read this as ${plural(m.deliverables.length, 'thing')} to deliver: ${names}.`, tone: '', title: m.deliverables.join(', '), nodeId: 'goal' });
  }
  for (const r of ev(events, 'GOAL_REJECTED')) {
    c1.push({ id: `rej-${r.seq}`, text: `I could not accept this goal${r.data?.code ? ` (${plain(String(r.data.code))})` : ''}.`, tone: 'bad', title: String(r.data?.code ?? ''), nodeId: 'goal' });
  }
  for (const q of m.questions) {
    c1.push({ id: `q-${q.id}`, text: `I asked: ${q.question}${q.whyAsked ? ` (${q.whyAsked})` : ''}`, tone: 'redo', nodeId: 'goal' });
    c1.push(q.answered
      ? { id: `a-${q.id}`, text: `You answered: ${q.answer}`, tone: 'ok', nodeId: 'goal' }
      : { id: `a-${q.id}`, text: 'Waiting for your answer.', tone: 'redo', nodeId: 'goal' });
  }
  if (m.unsupported.length) {
    const u = m.unsupported.filter((x) => !x.startsWith('source:')).map(plain);
    if (u.length) c1.push({ id: 'unsupported', text: `I cannot produce: ${u.join(', ')}.`, tone: 'bad', title: m.unsupported.join(', '), nodeId: 'goal' });
  }

  // ---- 2. What I looked at
  const c2: StoryLine[] = m.sources.map((s, i) => ({
    id: `src-${i}`, text: `${plain(s.file)}: ${plural(s.rows, 'row')}`, tone: '' as LineTone, title: s.file, nodeId: 'sources',
  }));
  if (m.lmsSnapshot) {
    const bits: string[] = [];
    if (m.lmsSnapshot.learners !== null) bits.push(plural(m.lmsSnapshot.learners, 'learner'));
    if (m.lmsSnapshot.helpRequests !== null) bits.push(plural(m.lmsSnapshot.helpRequests, 'help request'));
    if (bits.length) c2.push({ id: 'lms', text: `Class data read from the portal: ${bits.join(', ')}`, tone: '', nodeId: 'sources' });
  }
  for (const b of m.blockedSources) {
    c2.push({ id: `blk-${b.sourceId}`, text: `Missing input: ${plain(b.sourceId)}. Nothing will be guessed.`, tone: 'bad', title: `${b.sourceId} ${b.code}`, nodeId: 'sources' });
  }

  // ---- 3. How I broke it down
  const c3: StoryLine[] = [];
  const byId = new Map(m.tasks.map((t) => [t.id, t]));
  const heads = ['First', 'Then', 'After that'];
  let lastHead = -1;
  for (const t of [...m.tasks].sort((a, b) => depth(a, byId) - depth(b, byId))) {
    const h = Math.min(depth(t, byId), 2);
    if (h !== lastHead) { c3.push({ id: `h-${h}`, text: heads[h]!, tone: '', heading: true }); lastHead = h; }
    c3.push({ id: `t-${t.id}`, text: `${t.role} will ${lowerFirst(t.label)}`, tone: '', title: t.id, nodeId: t.id });
  }
  if (m.tasks.length) {
    const helpers = new Set(m.tasks.map((t) => t.role)).size;
    c3.push({ id: 'helpers', text: `Only these ${helpers} helpers were needed.`, tone: '' });
  }
  for (const [i, j] of m.joined.entries()) {
    c3.push({ id: `j-${i}`, text: `${j.agent} joined: ${j.reason.replace(/\b[a-z]+(?:_[a-z]+)+\b/g, plain)}`, tone: '', title: j.capabilityId, nodeId: m.tasks.find((t) => t.capabilityId === j.capabilityId)?.id });
  }

  // ---- 4. What each helper did and handed on (chronological)
  const c4: StoryLine[] = [];
  const done = new Set<string>();
  for (const e of events) {
    if (e.type === 'TASK_COMPLETED' && e.taskId) {
      const again = done.has(e.taskId);
      done.add(e.taskId);
      const base = summarySentence(e.role ?? roleOf(e.taskId), e.taskId, e.data?.summary);
      c4.push({ id: `done-${e.seq}`, text: again ? `Re-ran on the repaired file: ${base}` : base, tone: again ? 'redo' : 'ok', title: e.taskId, nodeId: e.taskId });
    } else if (e.type === 'HANDOFF' && e.data?.artifact) {
      c4.push({
        id: `hand-${e.seq}`, text: `${roleOf(e.data.from)} handed the ${plainArtifact(String(e.data.artifact))} to the ${roleOf(e.data.to)}`,
        tone: '', title: `${e.data.from} -> ${e.data.to}: ${e.data.artifact}`, nodeId: String(e.data.to),
      });
    } else if (e.type === 'AGENT_MESSAGE' && e.data?.reason && e.data.type !== 'CHALLENGE' && e.data.type !== 'ESCALATE') {
      c4.push({ id: `msg-${e.seq}`, text: `${e.data.from} to ${e.data.to}: ${e.data.reason}`, tone: '', title: String(e.data.type ?? '') });
    } else if (e.type === 'TASK_FAILED') {
      c4.push({ id: `fail-${e.seq}`, text: `${e.role ?? roleOf(e.taskId)} failed: ${e.data?.message ?? 'no reason given'}`, tone: 'bad', nodeId: e.taskId ?? undefined });
    }
  }

  // ---- 5. Checking and fixing (chronological)
  const c5: StoryLine[] = [];
  let total = 0, pass = 0;
  for (const e of events) {
    const d = e.data ?? {};
    if (e.type === 'REVIEW_STARTED') { total = 0; pass = 0; }
    else if (e.type === 'CHECK_RESULT') { total += 1; if (d.status === 'PASS') pass += 1; }
    else if (e.type === 'VERIFICATION_FAILED') {
      c5.push({ id: `rf-${e.seq}`, text: `Round ${d.round}: The Reviewer re-checked everything from the raw files: ${pass} of ${total} checks passed`, tone: 'bad', nodeId: 'review' });
      const msgs: string[] = d.messages ?? [];
      msgs.forEach((msg, i) => c5.push({ id: `rm-${e.seq}-${i}`, text: `Problem: ${msg}`, tone: 'bad', title: (d.failed ?? [])[i], nodeId: 'review' }));
    } else if (e.type === 'REPAIR_SCHEDULED') {
      c5.push({ id: `rs-${e.seq}`, text: `Round ${d.round}: Repair ${plain(String(d.strategy))}`, tone: 'redo', title: String(d.strategy), nodeId: 'repair' });
    } else if (e.type === 'ARTIFACT_REPAIRED') {
      const changes = ((d.changes ?? []) as any[]).map(describeChange).filter((x): x is string => !!x);
      c5.push({
        id: `ra-${e.seq}`, tone: 'redo', nodeId: 'repair', title: `${d.from} -> ${d.to}`,
        text: changes.length ? `Changed: ${changes.join('; ')}. The old ${plain(String(d.from))} is kept.` : `Wrote ${plainArtifact(String(d.to))} with ${plural((d.changes ?? []).length, 'change')}.`,
      });
    } else if (e.type === 'VERIFICATION_PASSED') {
      c5.push({ id: `rp-${e.seq}`, text: `Round ${d.round}: The Reviewer re-checked everything from the raw files: ${d.passed} of ${d.total} checks passed`, tone: 'ok', nodeId: 'review' });
    } else if (e.type === 'AGENT_MESSAGE' && d.reason && (d.type === 'CHALLENGE' || d.type === 'ESCALATE')) {
      c5.push({ id: `cm-${e.seq}`, text: `${d.from} ${d.type === 'CHALLENGE' ? 'challenged' : 'escalated to'} ${d.to}: ${d.reason}`, tone: 'redo' });
    }
  }
  const fin = m.finished;
  if (fin) {
    if (fin.status === 'VERIFIED') {
      c5.push({ id: 'fin', text: `All ${fin.checksTotal} checks pass. Nothing is sent until you approve.`, tone: 'ok', nodeId: 'deliver' });
    } else {
      c5.push({ id: 'fin', text: `Finished with ${fin.checksPassed} of ${fin.checksTotal} checks passing${fin.reason ? `: ${fin.reason}` : ''}. Nothing was sent.`, tone: 'bad', nodeId: fin.status === 'BLOCKED' ? 'blocked' : 'deliver' });
    }
  }
  if (m.delivered) c5.push({ id: 'delivered', text: `Delivered to ${plural(m.delivered.count, 'portal inbox', 'portal inboxes')} after your approval.`, tone: 'ok', nodeId: 'deliver' });

  const st = (s: string): ChapterStatus => (s === 'done' ? 'done' : s === 'bad' ? 'bad' : s === 'active' ? 'active' : 'idle');
  const reviewStatus: ChapterStatus = fin ? (fin.status === 'VERIFIED' ? 'done' : 'bad') : m.reviewState === 'idle' ? 'idle' : m.reviewState === 'passed' ? 'done' : 'active';

  return [
    { n: 1, id: 'asked', title: 'What you asked', icon: 'goal', status: m.stage.goal === 'idle' && c1.length ? 'active' : st(m.stage.goal), lines: c1, waiting: 'Waiting for the goal.' },
    { n: 2, id: 'looked', title: 'What I looked at', icon: 'sources', status: m.blockedSources.length ? 'bad' : c2.length ? 'done' : 'idle', lines: c2, waiting: 'No files read yet.' },
    { n: 3, id: 'plan', title: 'How I broke it down', icon: 'plan', status: st(m.stage.plan), lines: c3, waiting: 'The plan has not been made yet.' },
    { n: 4, id: 'work', title: 'What each helper did and handed on', icon: 'work', status: st(m.stage.execute), lines: c4, waiting: 'No helper has finished a step yet.' },
    { n: 5, id: 'check', title: 'Checking and fixing', icon: 'review', status: reviewStatus, lines: c5, waiting: 'Nothing has been checked yet.' },
  ];
}

export const storyLineCount = (chapters: StoryChapter[]) => chapters.reduce((n, c) => n + c.lines.length, 0);
