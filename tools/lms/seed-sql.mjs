// Builds the LMS seed SQL from the same synthetic fixtures the engine uses (so ids and scores agree).
// Usage: node tools/lms/seed-sql.mjs > <file>.sql   (apply to the LMS database once)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../../engine/csv.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => fs.readFileSync(root + p, 'utf8');
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const skills = parseCsv(read('fixtures/education-recovery/v1/skills.csv')).rows;
const trainees = parseCsv(read('fixtures/education-recovery/v1/trainees.csv')).rows;
const mentors = parseCsv(read('fixtures/education-recovery/v1/mentors.csv')).rows;
const availability = parseCsv(read('fixtures/education-recovery/v1/availability.csv')).rows;
const assessments = parseCsv(read('fixtures/education-recovery/v1/assessments.csv')).rows;
const questions = JSON.parse(read('fixtures/lms/questions.json'));

const out = [];
out.push('begin;');
out.push(`insert into lms.skills(id, name, threshold) values ${skills.map((s) => `(${q(s.skill_id)}, ${q(s.name)}, ${Number(s.threshold)})`).join(', ')} on conflict (id) do nothing;`);
out.push(`insert into lms.profiles(id, kind, display_name, first_login_day) values ${trainees.map((t) => `(${q(t.trainee_id)}, 'learner', ${q(t.display_name)}, ${Number(t.first_login_day)})`).join(', ')} on conflict (id) do nothing;`);
out.push(`insert into lms.profiles(id, kind, display_name, mentor_skills, capacity) values ${mentors.map((m) => `(${q(m.mentor_id)}, 'mentor', ${q(m.display_name)}, array[${m.skills.split(';').map(q).join(',')}]::text[], ${Number(m.capacity)})`).join(', ')} on conflict (id) do nothing;`);
out.push(`insert into lms.availability(mentor_id, day, start_hm, end_hm) values ${availability.map((a) => `(${q(a.mentor_id)}, ${q(a.day)}, ${q(a.start)}, ${q(a.end)})`).join(', ')} on conflict do nothing;`);
const present = assessments.filter((a) => String(a.score).trim() !== '');
out.push(`insert into lms.attempts(profile_id, skill_id, score, minutes, source, created_at) values ${present.map((a) => `(${q(a.trainee_id)}, ${q(a.skill_id)}, ${Number(a.score)}, 0, 'seed', '2026-11-09T08:00:00Z')`).join(', ')};`);
out.push(`insert into lms.questions(id, skill_id, prompt, options, answer_index, explanation) values ${questions.map((x) => `(${q(x.id)}, ${q(x.skill_id)}, ${q(x.prompt)}, ${q(JSON.stringify(x.options))}::jsonb, ${x.answer_index}, ${q(x.explanation)})`).join(', ')} on conflict (id) do nothing;`);
out.push('commit;');
process.stdout.write(out.join('\n') + '\n');
