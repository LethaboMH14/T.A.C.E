// End-to-end smoke test of the live LMS API (as a phone would call it), then a demo reset.
// Usage: node tools/lms/smoke.mjs   (reads LMS_URL, LMS_PUBLISHABLE_KEY, LMS_ADMIN_TOKEN from repo/.env; prints no secrets)
import { fileURLToPath } from 'node:url';
try { process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url))); } catch {}
const { LMS_URL, LMS_PUBLISHABLE_KEY, LMS_ADMIN_TOKEN } = process.env;
const rpc = async (fn, args = {}) => {
  const r = await fetch(`${LMS_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: LMS_PUBLISHABLE_KEY, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${fn}: HTTP ${r.status} ${body?.message ?? ''}`);
  return body;
};
const ok = (label, v) => console.log(`✓ ${label}`, v ?? '');
const profiles = await rpc('lms_list_profiles');
ok('list profiles', `${profiles.length} (${profiles.filter((p) => p.kind === 'mentor').length} mentors)`);
const token = await rpc('lms_login', { p_id: 'L-07', p_pin: '4321' });
ok('login L-07 (claims it)', token ? 'session issued' : 'NO TOKEN');
try { await rpc('lms_login', { p_id: 'L-07', p_pin: '9999' }); console.log('✗ wrong PIN was accepted'); } catch (e) { ok('wrong PIN refused', e.message.replace(/^.*HTTP \d+ /, '')); }
const quiz = await rpc('lms_quiz', { p_token: token, p_skill: 'S3' });
ok('quiz S3 (no answers sent to phone)', `${quiz.length} questions, answer key present: ${JSON.stringify(quiz).includes('answer_index')}`);
const res = await rpc('lms_submit_quiz', { p_token: token, p_skill: 'S3', p_answers: [2, 0, 1], p_minutes: 7 });
ok('submit quiz (marked in database)', `${res.correct}/${res.total} = ${res.score}`);
await rpc('lms_request_help', { p_token: token, p_skill: 'S3', p_category: 'concept', p_text: 'I don’t get default arguments in functions' });
ok('help request saved');
await rpc('lms_set_prefs', { p_token: token, p_format: 'audio', p_language: 'zu' });
const me = await rpc('lms_me', { p_token: token });
ok('me', `${me.profile.display_name} · prefs ${JSON.stringify(me.profile.prefs)} · S3 latest ${me.skills.find((s) => s.id === 'S3').latest.score} · help ${me.help.length}`);
try { await rpc('lms_admin_export', { p_admin: 'not-the-token' }); console.log('✗ admin export without token worked'); } catch { ok('admin export refused without token'); }
const ex = await rpc('lms_admin_export', { p_admin: LMS_ADMIN_TOKEN });
ok('admin export', `${ex.profiles.length} profiles · ${ex.latest.length} latest scores · ${ex.help.length} help · ${ex.availability.length} windows`);
const feed = await rpc('lms_admin_feed', { p_admin: LMS_ADMIN_TOKEN, p_after_attempt: 0, p_after_help: 0 });
ok('admin feed (live activity)', `${feed.attempts.length} new attempts · ${feed.help.length} help · ${feed.claimed} claimed`);
const n = await rpc('lms_admin_deliver', { p_admin: LMS_ADMIN_TOKEN, p_run: 'smoke', p_messages: [{ profile_id: 'L-07', subject: 'Smoke test', body: 'Delivered to your portal inbox', format: 'text' }] });
const inbox = await rpc('lms_inbox', { p_token: token });
ok('deliver → inbox', `${n} delivered · inbox has ${inbox.length}`);
await rpc('lms_admin_reset', { p_admin: LMS_ADMIN_TOKEN });
const after = await rpc('lms_list_profiles');
ok('demo reset', `claimed now ${after.filter((p) => p.claimed).length}`);
