// Mission Studio client. It renders ONLY what the run's ledger (events.jsonl) and files say.
// No status, number or colour on this page is decided here without an event behind it.

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (id, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const ROLE_ICON = { Analyst: 'analyst', 'Report Writer': 'report', 'Support Planner': 'plan', Scheduler: 'calendar', 'Message Writer': 'message' };
const PRETTY_SOURCE = (f) => f;

let es = null;
let S = null; // run state
const sourceCache = new Map();

function fresh(runId) {
  return {
    runId, events: [], start: null, last: null, finished: null, pace: 0,
    title: '', goal: '', deliverables: [], unsupported: [], sources: [], blocked: [],
    tasks: [], task: {}, summary: {}, review: { state: 'idle', round: 0 }, checks: new Map(),
    files: new Map(), verifiedSeq: 0, failedRounds: [], repairs: [], selectedCheck: null,
    chain: Promise.resolve(), // autopsy steps fetch files; keep them in ledger order
  };
}
const later = (fn) => { const run = S; run.chain = run.chain.then(() => (S === run ? fn() : null)).catch((e) => console.error(e)); };
function plantedText(f, d) {
  const bits = [];
  if (f?.kind === 'overlap') bits.push(`the Scheduler is set to double-book ${f.mentor_id === 'M-B' ? 'Mentor B' : f.mentor_id} once`);
  if (f?.kind === 'wrong_aggregate') bits.push(`the Report Writer is set to count missing ${f.skill_id} scores as zero`);
  for (const u of d.changedConstraints || []) bits.push(`${u.mentor_id === 'M-B' ? 'Mentor B' : u.mentor_id} is away on ${u.day}`);
  for (const s of d.excludedSources || []) bits.push(`the ${s} file is withheld`);
  return bits;
}

/* ---------------------------------------------------------------- boot */
async function boot() {
  const [scen, runs] = await Promise.all([fetch('/api/scenarios').then((r) => r.json()), fetch('/api/runs').then((r) => r.json())]);
  $('#scenario').innerHTML = scen.map((s) => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('');
  const pick = new URLSearchParams(location.search).get('scenario');
  if (pick && scen.some((s) => s.id === pick)) $('#scenario').value = pick;
  else if (scen.some((s) => s.id === 'inject_overlap')) $('#scenario').value = 'inject_overlap';
  fillReplay(runs);
  const want = new URLSearchParams(location.search).get('run');
  if (want) open(want);
  else if (runs[0]) open(runs[0].runId);
  window.addEventListener('resize', () => layoutGraph());
}

function fillReplay(runs) {
  $('#replay').innerHTML = '<option value="">Earlier runs</option>' + runs.slice(0, 30).map((r) => `<option value="${esc(r.runId)}">${esc(r.title || r.runId)} · ${esc(r.status)}</option>`).join('');
}

$('#runbar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#runBtn');
  btn.disabled = true;
  try {
    const r = await fetch('/api/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: $('#scenario').value }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'could not start');
    open(j.runId);
  } catch (err) {
    feed(`Could not start the run: ${err.message}`, 'bad');
  } finally { setTimeout(() => (btn.disabled = false), 800); }
});
$('#replay').addEventListener('change', (e) => { if (e.target.value) open(e.target.value); });
$('#drawerClose').addEventListener('click', () => ($('#drawer').hidden = true));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#drawer').hidden = true; });

function open(runId) {
  if (es) es.close();
  S = fresh(runId);
  history.replaceState(null, '', `?run=${encodeURIComponent(runId)}`);
  resetView();
  es = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
  es.onmessage = (m) => { try { apply(JSON.parse(m.data)); } catch (err) { console.error(err); } };
  es.addEventListener('end', () => { es.close(); fetch('/api/runs').then((r) => r.json()).then(fillReplay); });
}

function resetView() {
  $('#runId').textContent = S.runId;
  $('#missionTitle').textContent = 'Loading…';
  $('#countLine').innerHTML = 'Every number on this page comes from the run’s own files and ledger.';
  $('#goalText').textContent = '—';
  $('#goalVerdict').innerHTML = '';
  $('#deliverables').innerHTML = '';
  $('#sources').innerHTML = '';
  $('#feed').innerHTML = '';
  $('#nodes').innerHTML = '';
  $('#edges').innerHTML = '';
  $('#roster').innerHTML = '';
  $('#graph').classList.remove('has-plan');
  $('#checks').innerHTML = '';
  $('#autopsy').innerHTML = ''; $('#autopsy').hidden = true;
  $('#xray').hidden = true;
  $('#planted').hidden = true;
  $('#files').innerHTML = '';
  $('#paceNote').hidden = true;
  setStatus('running', 'Running');
  for (const li of document.querySelectorAll('#stepper li')) li.removeAttribute('data-state');
}

/* ---------------------------------------------------------------- reducer */
function apply(e) {
  S.events.push(e);
  if (!S.start) S.start = Date.parse(e.ts);
  S.last = Date.parse(e.ts);
  tick();
  const d = e.data || {};
  switch (e.type) {
    case 'RUN_STARTED':
      S.title = d.title; S.goal = d.goalText; S.pace = d.pacedMs || 0;
      $('#footNote').textContent = `Synthetic data only. ${d.agents?.mode === 'model' ? `Agents use ${d.agents.provider} · ${d.agents.model}; every model output is checked by code.` : 'Code only: no model took part in this run.'} Nothing is sent: messages stay as drafts until a person approves them.`;
      $('#missionTitle').textContent = d.title;
      $('#goalText').textContent = d.goalText;
      { const p = plantedText(d.plantedFault, d); const el = $('#planted'); el.hidden = !p.length; if (p.length) el.innerHTML = `${icon('alert')}<span>${d.plantedFault ? 'Planted on purpose for this demo' : 'Changed for this scenario'}: ${esc(p.join('; '))}. It is declared in the scenario file and in the ledger.</span>`; }
      if (S.pace) { const n = $('#paceNote'); n.hidden = false; n.textContent = `Each step waits ${(S.pace / 1000).toFixed(2)} s so you can follow it. The work itself is real and runs in milliseconds.`; }
      step('goal', 'active');
      feed('Mission started');
      break;
    case 'GOAL_VALIDATED':
      S.deliverables = d.deliverables;
      $('#goalVerdict').innerHTML = `${icon('check')}<span>Goal accepted by the G02 validator. That means the request is well-formed, <b>not</b> that any action is approved.</span>`;
      $('#deliverables').innerHTML = d.deliverables.map((x) => `<li data-d="${esc(x)}">${esc(x)}</li>`).join('');
      step('goal', 'done'); step('plan', 'active');
      feed(`Goal checked: <b>${d.deliverables.length}</b> deliverables requested`);
      break;
    case 'GOAL_REJECTED':
      step('goal', 'bad');
      feed(`Goal not accepted (${esc(d.code)})`, 'bad');
      break;
    case 'SOURCE_ADMITTED':
      S.sources.push(d);
      $('#sources').insertAdjacentHTML('beforeend', `<li title="sha256 ${esc(d.digest)}">${icon('check')}<span class="name">${esc(d.file)}</span><span class="meta">${esc(d.rows)} rows · ${esc(d.digest.slice(0, 8))}</span></li>`);
      break;
    case 'SOURCE_BLOCKED':
      S.blocked.push(d);
      $('#sources').insertAdjacentHTML('beforeend', `<li class="blocked">${icon('x')}<span class="name">${esc(d.sourceId)}</span><span class="meta">${esc(d.code === 'MISSING_SOURCE' ? 'missing' : d.code)}</span></li>`);
      feed(`Missing input: <b>${esc(d.sourceId)}</b>. Nothing will be guessed.`, 'bad');
      break;
    case 'PLAN_CREATED':
      S.tasks = d.tasks; S.unsupported = d.unsupported;
      for (const t of d.tasks) S.task[t.id] = 'pending';
      for (const u of d.unsupported) { const li = document.querySelector(`#deliverables li[data-d="${CSS.escape(u)}"]`); if (li) { li.classList.add('unsupported'); li.title = 'Cannot be produced from the admitted sources'; } }
      buildGraph();
      step('plan', d.tasks.length ? 'done' : 'bad');
      if (d.tasks.length) step('execute', 'active');
      feed(d.tasks.length ? `Plan: <b>${d.tasks.length}</b> step${d.tasks.length > 1 ? 's' : ''}, ${d.tasks.map((t) => esc(t.role)).join(', ')}` : 'No step can run without the missing input', d.tasks.length ? '' : 'bad');
      if (d.unsupported.length && d.tasks.length) feed(`Cannot produce: ${d.unsupported.filter((u) => !u.startsWith('source:')).map(esc).join(', ')}`, 'bad');
      break;
    case 'TASK_STARTED':
      setNode(e.taskId, S.review.state === 'repairing' ? 'repairing' : 'running');
      if (!(e.taskId in S.task)) break;
      S.task[e.taskId] = 'running';
      feed(`<b>${esc(e.role)}</b> started: ${esc(taskLabel(e.taskId))}`);
      break;
    case 'HANDOFF':
      flowEdge(d.from, d.to);
      feed(`${esc(e.role)} received <span class="mono">${esc(d.artifact)}</span>`);
      break;
    case 'ARTIFACT_WRITTEN':
      addFile(d, e);
      break;
    case 'TASK_COMPLETED':
      S.task[e.taskId] = 'done'; S.summary[e.taskId] = d.summary;
      setNode(e.taskId, 'done', summaryBadge(e.taskId, d.summary));
      doneEdgesInto(e.taskId);
      feed(summarySentence(e.role, e.taskId, d.summary), '');
      countLine();
      if (S.tasks.every((t) => S.task[t.id] === 'done')) step('execute', 'done');
      break;
    case 'TASK_FAILED':
      setNode(e.taskId, 'failed');
      feed(`<b>${esc(e.role)}</b> failed: ${esc(d.message)}`, 'bad');
      break;
    case 'TASK_SKIPPED':
      setNode(e.taskId, 'skipped');
      break;
    case 'TASK_RERUN':
      S.task[e.taskId] = 'pending';
      setNode(e.taskId, 'repairing', { text: 're-run', cls: 'redo' });
      feed(`<b>${esc(e.role)}</b> re-runs on the repaired file`, 'redo');
      break;
    case 'REVIEW_STARTED':
      S.review = { state: 'running', round: d.round };
      step('execute', 'done'); step('verify', 'active');
      setNode('review', 'running', { text: `round ${d.round}`, cls: '' });
      if (d.round === 1) for (const t of S.tasks) if (!t.dependents?.length) {}
      edgeClass('sinks', 'flow', 900);
      feed(`<b>Reviewer</b> round ${d.round}: re-opening every file`);
      break;
    case 'CHECK_RESULT':
      upsertCheck(d, e);
      break;
    case 'VERIFICATION_FAILED':
      S.review.state = 'failed'; S.failedRounds.push(d);
      setNode('review', 'failed', { text: `${d.failed.length} failed`, cls: 'bad' });
      step('verify', 'bad');
      setStatus('running', 'Problem found');
      later(() => openCase(d));
      feed(`<b>Reviewer</b> caught a problem: ${esc(d.messages?.[0] ?? d.failed.join(', '))}`, 'bad');
      break;
    case 'REPAIR_SCHEDULED':
      S.review.state = 'repairing';
      setNode('repair', 'repairing', { text: `round ${d.round}`, cls: 'redo' });
      edgeClass('review>repair', 'hot');
      feed(`<b>Repair</b>: ${esc(plainStrategy(d.strategy))}`, 'redo');
      break;
    case 'ARTIFACT_REPAIRED':
      S.repairs.push(d);
      setNode('repair', 'done', { text: `${d.changes.length} change${d.changes.length === 1 ? '' : 's'}`, cls: 'redo' });
      later(() => showRepair(d));
      feed(`<b>Repair</b> wrote <span class="mono">${esc(d.to)}</span>, ${d.changes.length} change${d.changes.length === 1 ? '' : 's'}; <span class="mono">${esc(d.from)}</span> kept`, 'redo');
      break;
    case 'VERIFICATION_PASSED':
      S.review.state = 'passed'; S.verifiedSeq = e.seq;
      setNode('review', 'done', { text: `${d.passed}/${d.total}`, cls: 'ok' });
      edgeClass('review>repair', null);
      step('verify', 'done');
      if (S.failedRounds.length) later(() => showPass(d));
      markVerifiedFiles();
      feed(`<b>Reviewer</b> round ${d.round}: <b>${d.passed} of ${d.total}</b> checks passed`, 'ok');
      break;
    case 'RUN_FINISHED':
      S.finished = d;
      setStatus(d.status, d.status === 'VERIFIED' ? 'Verified' : d.status === 'PARTIAL' ? 'Partial' : 'Blocked');
      step('deliver', d.status === 'BLOCKED' ? 'bad' : 'done');
      if (d.status !== 'BLOCKED') setNode('deliver', 'done', { text: `${d.checksPassed}/${d.checksTotal} checks`, cls: d.status === 'VERIFIED' ? 'ok' : 'bad' });
      else setNode('blocked', 'blocked');
      countLine();
      feed(`Mission <b>${esc(d.status)}</b>${d.repairs ? ` after ${d.repairs} repair${d.repairs > 1 ? 's' : ''}` : ''}${d.reason ? `: ${esc(d.reason)}` : ''}`, d.status === 'VERIFIED' ? 'ok' : 'bad');
      break;
  }
}

/* ---------------------------------------------------------------- header */
function step(name, state) { const li = document.querySelector(`#stepper li[data-step="${name}"]`); if (li) li.setAttribute('data-state', state); }
function setStatus(state, text) { const s = $('#status'); s.dataset.state = state; s.textContent = text; }
let clockTimer = null;
function tick() {
  const render = () => {
    if (!S?.start) return;
    const end = S.finished ? S.last : Math.max(S.last, Date.now());
    const ms = Math.max(0, end - S.start);
    $('#clock').textContent = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  };
  render();
  clearInterval(clockTimer);
  if (!S.finished) clockTimer = setInterval(render, 100);
}
function countLine() {
  const g = S.summary.compute_gaps, sch = S.summary.mentor_schedule, dr = S.summary.draft_messages;
  const bits = [];
  if (g) bits.push(`<b>${g.atRisk}</b> of <b>${g.trainees}</b> learners at risk`, `<b>${g.gaps}</b> skill gaps`, `<b>${g.missing}</b> missing scores flagged`);
  if (sch) bits.push(`<b>${sch.booked}</b> sessions booked${sch.unscheduled ? `, <b>${sch.unscheduled}</b> unscheduled` : ''}`);
  if (dr) bits.push(`<b>${dr.drafts}</b> drafts, all unsent`);
  if (S.finished && S.finished.checksTotal) bits.push(`<b>${S.finished.checksPassed}/${S.finished.checksTotal}</b> checks`);
  if (bits.length) $('#countLine').innerHTML = bits.join('<span class="sep">/</span>');
}

/* ---------------------------------------------------------------- feed */
function feed(html, cls = '') {
  if (!S) return;
  const t = S.last && S.start ? (S.last - S.start) / 1000 : 0;
  const li = document.createElement('li');
  if (cls) li.className = cls;
  li.innerHTML = `<time class="mono">+${t.toFixed(1)}s</time><span>${html}</span>`;
  const list = $('#feed');
  const stick = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  list.appendChild(li);
  if (stick) list.scrollTop = list.scrollHeight;
}
const taskLabel = (id) => S.tasks.find((t) => t.id === id)?.label ?? id;
function summarySentence(role, id, s) {
  if (!s) return `<b>${esc(role)}</b> finished`;
  switch (id) {
    case 'compute_gaps': return `<b>Analyst</b> found <b>${s.gaps}</b> gaps; <b>${s.atRisk}</b> learners at risk; ${s.missing} missing scores flagged, not counted as zero`;
    case 'performance_summary': return `<b>Report Writer</b> summarised ${s.skills} skills`;
    case 'recommend_interventions': return `<b>Support Planner</b> matched ${s.items} support items (${s.mentorSessions} mentor sessions)`;
    case 'mentor_schedule': return `<b>Scheduler</b> booked <b>${s.booked}</b> sessions${s.unscheduled ? `, ${s.unscheduled} could not be placed` : ''}`;
    case 'draft_messages': return `<b>Message Writer</b> drafted ${s.drafts} messages. None sent`;
    default: return `<b>${esc(role)}</b> finished`;
  }
}
function summaryBadge(id, s) {
  if (!s) return null;
  const t = { compute_gaps: `${s.atRisk} at risk`, performance_summary: `${s.skills} skills`, recommend_interventions: `${s.items} items`, mentor_schedule: `${s.booked} booked`, draft_messages: `${s.drafts} drafts` }[id];
  return t ? { text: t, cls: '' } : null;
}
const plainStrategy = (s) => ({ reschedule_affected_sessions: 'move only the sessions that break a rule', recompute_affected_numbers: 'recompute only the wrong numbers from the raw scores', regenerate_from_latest_schedule: 'rewrite drafts from the latest schedule', rerun_producer: 're-run the step that made the file' }[s] || s);

/* ---------------------------------------------------------------- graph */
const NODE_W = 216, NODE_H = 58, ROW = 84, HG = 20;
function buildGraph() {
  const g = $('#graph');
  g.classList.add('has-plan');
  const nodes = [];
  nodes.push({ id: 'goal', role: 'Goal', sub: `${S.deliverables.length} deliverables`, icon: 'goal', row: 0 });
  nodes.push({ id: 'sources', role: 'Sources', sub: S.blocked.length ? `${S.blocked.length} missing` : `${S.sources.length} files admitted`, icon: 'source', row: 1, state: S.blocked.length ? 'blocked' : 'done' });
  const depth = {};
  const d = (t) => (depth[t.id] ??= t.dependsOn.length ? 1 + Math.max(...t.dependsOn.map((x) => d(S.tasks.find((y) => y.id === x)))) : 0);
  for (const t of S.tasks) nodes.push({ id: t.id, role: t.role, sub: t.label, icon: ROLE_ICON[t.role] || 'report', row: 2 + d(t) });
  const lastRow = Math.max(1, ...nodes.map((n) => n.row));
  if (S.tasks.length) {
    nodes.push({ id: 'review', role: 'Reviewer', sub: 'Recomputes from the raw files', icon: 'review', row: lastRow + 1, pair: 'left' });
    nodes.push({ id: 'repair', role: 'Repair', sub: 'Fixes only what failed', icon: 'repair', row: lastRow + 1, pair: 'right' });
    nodes.push({ id: 'deliver', role: 'Deliver', sub: 'Verified files + manifest', icon: 'deliver', row: lastRow + 2 });
  } else {
    nodes.push({ id: 'blocked', role: 'Stopped', sub: 'Needs the missing input', icon: 'alert', row: 2 });
  }
  S.graph = { nodes, edges: [] };
  const E = S.graph.edges;
  E.push(['goal', 'sources']);
  for (const t of S.tasks) {
    if (!t.dependsOn.length) E.push(['sources', t.id]);
    for (const p of t.dependsOn) E.push([p, t.id]);
  }
  const hasChild = new Set(S.tasks.flatMap((t) => t.dependsOn));
  for (const t of S.tasks) if (!hasChild.has(t.id)) E.push([t.id, 'review', 'sink']);
  if (S.tasks.length) { E.push(['review', 'repair', 'loop']); E.push(['review', 'deliver']); }
  else E.push(['sources', 'blocked']);

  $('#nodes').innerHTML = nodes.map((n) => `
    <div class="node" id="n-${n.id}" data-state="${n.state || (n.id === 'goal' ? 'done' : 'pending')}">
      <span class="glyph">${icon(n.icon)}</span>
      <span class="t"><span class="role">${esc(n.role)}</span><span class="sub">${esc(n.sub)}</span></span>
      <span class="state"></span>
    </div>`).join('');
  for (const n of nodes) paintState(n.id);
  $('#roster').innerHTML = S.tasks.map((t) => `<span id="r-${t.id}" data-state="pending">${esc(t.role)} <span class="kind">code</span></span>`).join('')
    + (S.tasks.length ? '<span id="r-review" data-state="pending">Reviewer <span class="kind">independent</span></span><span id="r-repair" data-state="pending">Repair <span class="kind">on demand</span></span>' : '');
  layoutGraph();
}

function layoutGraph() {
  if (!S?.graph) return;
  const box = $('#graph');
  const W = box.clientWidth;
  const nw = Math.min(NODE_W, (W - 3 * HG) / 2);
  const rows = new Map();
  for (const n of S.graph.nodes) { if (!rows.has(n.row)) rows.set(n.row, []); rows.get(n.row).push(n); }
  const pos = {};
  for (const [r, list] of rows) {
    const total = list.length * nw + (list.length - 1) * HG;
    let x = (W - total) / 2;
    for (const n of list) { pos[n.id] = { x, y: 18 + r * ROW, w: nw }; x += nw + HG; }
  }
  const maxRow = Math.max(...S.graph.nodes.map((n) => n.row));
  box.style.height = `${18 + maxRow * ROW + NODE_H + 22}px`;
  for (const n of S.graph.nodes) {
    const el = document.getElementById(`n-${n.id}`);
    const p = pos[n.id];
    el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; el.style.width = `${p.w}px`;
  }
  S.graph.pos = pos;
  const svg = $('#edges');
  svg.innerHTML = S.graph.edges.map(([a, b, kind]) => {
    const A = pos[a], B = pos[b];
    if (!A || !B) return '';
    let dpath;
    if (kind === 'loop') {
      const y = A.y + NODE_H / 2;
      dpath = `M ${A.x + A.w} ${y - 8} C ${A.x + A.w + 14} ${y - 26}, ${B.x - 14} ${y - 26}, ${B.x} ${y - 8} M ${B.x} ${y + 8} C ${B.x - 14} ${y + 26}, ${A.x + A.w + 14} ${y + 26}, ${A.x + A.w} ${y + 8}`;
    } else {
      const x1 = A.x + A.w / 2, y1 = A.y + NODE_H, x2 = B.x + B.w / 2, y2 = B.y;
      const my = (y1 + y2) / 2;
      dpath = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
    }
    return `<path id="e-${a}--${b}" data-kind="${kind || ''}" class="${kind === 'loop' ? 'loop' : ''}" d="${dpath}"/>`;
  }).join('');
  for (const id of Object.keys(S.task)) if (S.task[id] === 'done') doneEdgesInto(id);
  if (S.review.state === 'passed' || S.finished) { const e = edge('review', 'deliver'); if (e) e.classList.add('done'); }
}

function paintState(id) {
  const el = document.getElementById(`n-${id}`);
  if (!el) return;
  const st = el.dataset.state;
  const slot = el.querySelector('.state');
  slot.innerHTML = st === 'done' ? icon('check') : st === 'failed' || st === 'blocked' ? icon('x') : '';
}
function setNode(id, state, badge) {
  const el = document.getElementById(`n-${id}`);
  if (!el) return;
  el.dataset.state = state;
  paintState(id);
  const r = document.getElementById(`r-${id}`);
  if (r) r.dataset.state = state;
  el.querySelector('.badge')?.remove();
  if (badge) el.insertAdjacentHTML('beforeend', `<span class="badge ${badge.cls || ''}">${esc(badge.text)}</span>`);
}
const edge = (a, b) => document.getElementById(`e-${a}--${b}`);
function flowEdge(a, b) {
  const e = edge(a, b);
  if (!e) return;
  e.classList.add('flow');
  setTimeout(() => e.classList.remove('flow'), 1400);
}
function doneEdgesInto(id) {
  for (const p of document.querySelectorAll('#edges path')) if (p.id.endsWith(`--${id}`) || (p.id === 'e-goal--sources')) p.classList.add('done');
}
function edgeClass(which, cls, ms) {
  if (which === 'sinks') {
    for (const p of document.querySelectorAll('#edges path[data-kind="sink"]')) { p.classList.add('flow'); setTimeout(() => p.classList.remove('flow'), ms || 1200); }
    return;
  }
  const [a, b] = which.split('>');
  const e = edge(a, b);
  if (!e) return;
  e.classList.remove('hot');
  if (cls) e.classList.add(cls);
}

/* ---------------------------------------------------------------- review */
function upsertCheck(c, e) {
  const prev = S.checks.get(c.id);
  S.checks.set(c.id, { ...c, round: S.review.round, seq: e.seq });
  let li = document.getElementById(`c-${c.id}`);
  if (!li) {
    li = document.createElement('li');
    li.id = `c-${c.id}`;
    li.innerHTML = `<button type="button" aria-pressed="false"><span class="mark"></span><span><span class="title"></span><span class="cid"></span></span></button>`;
    li.querySelector('button').addEventListener('click', () => selectCheck(c.id));
    $('#checks').appendChild(li);
  }
  li.dataset.status = c.status;
  li.querySelector('.mark').innerHTML = c.status === 'PASS' ? icon('check') : c.status === 'FAIL' ? icon('x') : icon('alert');
  li.querySelector('.title').textContent = c.title;
  li.querySelector('.cid').textContent = `${c.id} · ${c.artifact}`;
  if (prev && prev.status !== c.status) { li.classList.remove('flip'); void li.offsetWidth; li.classList.add('flip'); }
  if (S.selectedCheck === c.id) selectCheck(c.id);
}

async function selectCheck(id) {
  S.selectedCheck = id;
  for (const b of document.querySelectorAll('#checks button')) b.setAttribute('aria-pressed', String(b.closest('li').id === `c-${id}`));
  const c = S.checks.get(id);
  const x = $('#xray');
  x.hidden = false;
  x.innerHTML = `<h3>Evidence X-Ray · ${esc(c.title)}</h3><p class="msg">${esc(c.message)}</p>
    ${c.expected != null || c.observed != null ? `<div class="eo"><div><small>Recomputed from sources</small><b>${esc(fmt(c.expected))}</b></div><div class="${c.status === 'PASS' ? '' : 'obs'}"><small>Found in ${esc(c.artifact)}</small><b>${esc(fmt(c.observed))}</b></div></div>` : ''}
    <div id="xrayRows"></div>`;
  const ev = (c.evidence || []).slice(0, 8);
  if (!ev.length) { $('#xrayRows').innerHTML = '<p class="more">This check reads the saved files directly; it cites no single source row.</p>'; return; }
  const rows = await Promise.all(ev.map(async (r) => ({ ...r, ...(await sourceRow(r.sourceId, r.row)) })));
  $('#xrayRows').innerHTML = `<table>${rows.map((r) => `<tr><td>${esc(r.file)}:${r.row}</td><td>${esc(r.text)}</td></tr>`).join('')}</table>${c.evidence.length > 8 ? `<p class="more">+${c.evidence.length - 8} more source rows</p>` : ''}`;
}
const fmt = (v) => (v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : v);
async function sourceRow(sourceId, row) {
  const file = `${sourceId}.csv`;
  if (!sourceCache.has(file)) sourceCache.set(file, fetch(`/api/sources/${file}`).then((r) => (r.ok ? r.text() : '')).then((t) => t.split('\n')));
  const lines = await sourceCache.get(file);
  return { file, text: lines[row - 1] ?? '(row not found)' };
}

/* ---------------------------------------------------------------- failure autopsy */
async function openCase(d) {
  const box = $('#autopsy');
  box.hidden = false;
  const failed = d.failed.map((id) => S.checks.get(id)).filter(Boolean);
  const c = failed[0];
  const conflict = c?.detail?.conflicts?.[0];
  const mism = c?.detail?.mismatches?.[0];
  box.insertAdjacentHTML('beforeend', `
    <article class="case" id="case-${d.round}">
      <div class="case-head">${icon('alert')}<div><h3>Reviewer caught ${failed.length === 1 ? 'a problem' : `${failed.length} problems`} in round ${d.round}</h3><p>${esc(c?.message ?? '')}</p></div></div>
      <div class="case-body" id="case-body-${d.round}">
        ${mism ? `<div class="eo"><div><small>Recomputed from raw scores</small><b>${esc(mism.expected)}</b></div><div class="obs"><small>Found in the report</small><b>${esc(mism.observed)}</b></div></div>` : ''}
        ${conflict ? `<p class="hint">Two sessions claim the same mentor at the same time. Source: <span class="mono">${esc(c.artifact)}</span></p>` : ''}
      </div>
    </article>`);
  if (conflict) await renderConflict(d.round, c);
}

async function fileText(rel) {
  const r = await fetch(`/api/runs/${encodeURIComponent(S.runId)}/file?path=${encodeURIComponent(rel)}`);
  return r.ok ? r.text() : '';
}
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [h, ...rest] = rows.filter((r) => r.length > 1 || r[0]);
  return { header: h || [], rows: rest.map((r) => Object.fromEntries((h || []).map((k, i) => [k, r[i] ?? '']))) };
}
async function renderConflict(round, c) {
  const file = S.files.get(c.artifact.split('@')[0])?.versions.find((v) => `${v.name}@v${v.version}` === c.artifact);
  if (!file) return;
  const { rows } = parseCsv(await fileText(file.file));
  const ids = new Set(c.detail.conflicts.flatMap((x) => x.sessions));
  const body = document.getElementById(`case-body-${round}`);
  body.insertAdjacentHTML('beforeend', `<table class="diff" id="diff-${round}"><caption>${esc(c.artifact)}: the clash</caption>
    <thead><tr><th>Session</th><th>Learner</th><th>Mentor</th><th>Day</th><th>Time</th></tr></thead>
    <tbody>${rows.filter((r) => ids.has(r.session_id)).map((r) => `<tr class="clash" data-s="${esc(r.session_id)}"><td>${esc(r.session_id)}</td><td>${esc(r.trainee_id)}</td><td>${esc(r.mentor_id)}</td><td>${esc(r.day)}</td><td>${esc(r.start)}</td></tr>`).join('')}</tbody></table>`);
}

async function showRepair(d) {
  const round = d.round;
  const body = document.getElementById(`case-body-${round}`);
  if (!body) return;
  body.insertAdjacentHTML('beforeend', `<div class="fixline">${icon('repair')}<span>Repair wrote <b>${esc(d.to)}</b> and kept <b>${esc(d.from)}</b>. ${d.changes.length} change${d.changes.length === 1 ? '' : 's'}, nothing else touched.</span></div>`);
  if (d.to.startsWith('mentor-schedule')) {
    const table = document.getElementById(`diff-${round}`);
    const v2ref = S.files.get('mentor-schedule.csv')?.versions.find((v) => `${v.name}@v${v.version}` === d.to);
    if (!table || !v2ref) return;
    const { rows } = parseCsv(await fileText(v2ref.file));
    const tbody = table.querySelector('tbody');
    for (const ch of d.changes) {
      const old = tbody.querySelector(`tr[data-s="${CSS.escape(ch.session_id)}"]`);
      if (old) { old.classList.remove('clash'); old.classList.add('gone'); }
      const r = rows.find((x) => x.session_id === ch.session_id);
      if (r) (old || tbody.lastElementChild).insertAdjacentHTML('afterend', `<tr class="new"><td>${esc(r.session_id)}</td><td>${esc(r.trainee_id)}</td><td>${esc(r.mentor_id)}</td><td>${esc(r.day)}</td><td>${esc(r.start)}</td></tr>`);
    }
    for (const tr of tbody.querySelectorAll('tr.clash')) tr.classList.remove('clash');
    table.querySelector('caption').textContent = `${d.from} → ${d.to}`;
  } else {
    body.insertAdjacentHTML('beforeend', `<table class="diff"><caption>${esc(d.from)} → ${esc(d.to)}</caption><thead><tr><th>Field</th><th>Was</th><th>Now</th></tr></thead><tbody>${d.changes.map((c) => `<tr class="new"><td>${esc(c.field ?? c.session_id)}</td><td>${esc(c.from)}</td><td>${esc(c.to)}</td></tr>`).join('')}</tbody></table>`);
  }
}
function showPass(d) {
  const last = S.failedRounds[S.failedRounds.length - 1];
  const body = document.getElementById(`case-body-${last.round}`);
  if (body) body.insertAdjacentHTML('beforeend', `<div class="passline">${icon('check')}<span>Re-checked from the files on disk: ${d.passed} of ${d.total} pass.</span></div>`);
}

/* ---------------------------------------------------------------- files */
const ORDER = ['gap-analysis.csv', 'performance-summary.md', 'performance-summary.json', 'improvement-plan.md', 'improvement-plan.json', 'mentor-schedule.csv', 'unsent-message-drafts.md', 'unsent-message-drafts.json', 'gaps.json', 'evidence-checks.json', 'repair-history.json', 'final-manifest.json'];
function addFile(ref, e) {
  if (!S.files.has(ref.name)) S.files.set(ref.name, { versions: [] });
  const f = S.files.get(ref.name);
  f.versions.push({ ...ref, seq: e.seq, by: e.role || ref.producer });
  renderFiles();
}
function markVerifiedFiles() { renderFiles(); }
function renderFiles() {
  const names = [...S.files.keys()].sort((a, b) => (ORDER.indexOf(a) + 99 * (ORDER.indexOf(a) < 0)) - (ORDER.indexOf(b) + 99 * (ORDER.indexOf(b) < 0)));
  const failedArtifacts = new Set(S.failedRounds.flatMap((r) => r.failed.map((id) => S.checks.get(id)?.artifact)).filter(Boolean));
  const ul = $('#files');
  for (const name of names) {
    const f = S.files.get(name);
    const latest = f.versions[f.versions.length - 1];
    let li = document.getElementById(`f-${CSS.escape(name)}`) || document.getElementById(`f-${name}`);
    if (!li) { li = document.createElement('li'); li.className = 'file'; li.id = `f-${name}`; ul.appendChild(li); }
    const verified = S.verifiedSeq && latest.seq < S.verifiedSeq && !['evidence-checks.json', 'repair-history.json', 'final-manifest.json'].includes(name);
    li.innerHTML = `
      <div class="top">${icon('file')}<div><div class="name">${esc(name)}</div><div class="by">by ${esc(latest.by)}</div></div></div>
      <div class="vers">${f.versions.map((v) => {
        const tag = `${v.name}@v${v.version}`;
        const old = v !== latest && failedArtifacts.has(tag);
        const ok = v === latest && verified;
        return `<button type="button" class="ver ${old ? 'old' : ok ? 'ok' : ''}" data-file="${esc(v.file)}" data-name="${esc(name)}" data-v="${v.version}" title="${old ? 'Failed review; kept for the record' : ok ? 'Passed independent review' : 'Open this version'}">${ok ? icon('check') : old ? icon('x') : ''}v${v.version}</button>`;
      }).join('')}</div>
      <div class="digest" title="sha256 ${esc(latest.digest)}">sha256 ${esc(latest.digest.slice(0, 16))}… · ${latest.bytes.toLocaleString()} B</div>`;
    for (const b of li.querySelectorAll('.ver')) b.addEventListener('click', () => preview(b.dataset.name, b.dataset.file, b.dataset.v));
  }
}

async function preview(name, file, v) {
  const text = await fileText(file);
  $('#drawer').hidden = false;
  $('#drawerTitle').textContent = `${name} · v${v}`;
  const ref = S.files.get(name)?.versions.find((x) => String(x.version) === String(v));
  $('#drawerMeta').textContent = ref ? `sha256 ${ref.digest}` : '';
  const body = $('#drawerBody');
  if (name.endsWith('.csv')) {
    const { header, rows } = parseCsv(text);
    const clash = new Set();
    if (name === 'mentor-schedule.csv') {
      const seen = new Map();
      for (const r of rows) if (r.status === 'BOOKED') { const k = `${r.mentor_id}|${r.day}|${r.start}`; if (seen.has(k)) { clash.add(r.session_id); clash.add(seen.get(k)); } else seen.set(k, r.session_id); }
    }
    body.innerHTML = `<table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr class="${clash.has(r.session_id) ? 'hl' : ''}">${header.map((h) => `<td>${esc(r[h])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  } else if (name.endsWith('.json')) {
    let pretty = text; try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {}
    body.innerHTML = `<pre>${esc(pretty)}</pre>`;
  } else {
    body.innerHTML = `${name.startsWith('unsent') ? '<span class="unsent">Unsent. Needs a person’s approval.</span>' : ''}<pre>${esc(text)}</pre>`;
  }
  $('#drawerClose').focus();
}

boot().catch((e) => { console.error(e); $('#missionTitle').textContent = 'Could not reach the Mission Studio server'; });
