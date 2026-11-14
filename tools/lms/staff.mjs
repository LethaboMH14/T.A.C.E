// Creates or updates a coordinator sign-in for the Studio server. The owner runs this; no account is created by code here.
//   node tools/lms/staff.mjs --email you@example.com --name "Coordinator"
// Reads LMS_URL, LMS_PUBLISHABLE_KEY and LMS_ADMIN_TOKEN from repo/.env. Password is typed twice, hidden, never printed.
import path from 'node:path';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { loadLocalEnv } from '../../cli/tace.mjs';
import { createLmsClient } from '../../engine/lms.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 10;

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

/** Reads lines from the terminal. When hidden, nothing typed is echoed. */
function terminalReader() {
  let muted = false;
  const out = new Writable({ write(chunk, enc, cb) { if (!muted) process.stdout.write(chunk, enc); cb(); } });
  const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });
  const ask = (label, hidden) => new Promise((resolve) => {
    process.stdout.write(label);
    muted = hidden;
    rl.question('', (answer) => {
      muted = false;
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
  return { ask, close: () => rl.close() };
}

async function main() {
  const a = args(process.argv.slice(2));
  const email = typeof a.email === 'string' ? a.email.trim() : '';
  const name = typeof a.name === 'string' ? a.name.trim() : '';
  if (!EMAIL_RE.test(email) || !name || name.length > 100) {
    console.error('usage: node tools/lms/staff.mjs --email you@example.com --name "Coordinator"');
    return 1;
  }
  if (!process.stdin.isTTY) {
    console.error('run this in an interactive terminal: the password is typed hidden');
    return 1;
  }
  loadLocalEnv();
  const lms = createLmsClient(process.env);
  if (!lms.adminConfigured) {
    console.error('LMS admin is not configured: set LMS_URL, LMS_PUBLISHABLE_KEY and LMS_ADMIN_TOKEN in repo/.env');
    return 1;
  }

  const term = terminalReader();
  let password;
  try {
    password = await term.ask('Password (hidden): ', true);
    const again = await term.ask('Type it again (hidden): ', true);
    if (password !== again) {
      console.error('the two passwords do not match; nothing was changed');
      return 1;
    }
    if (password.length < MIN_PASSWORD) {
      console.error(`the password must be at least ${MIN_PASSWORD} characters; nothing was changed`);
      return 1;
    }
  } finally {
    term.close();
  }

  await lms.admin('lms_admin_set_staff', { p_email: email, p_name: name, p_password: password });
  console.log(`Coordinator account ready: ${email}`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().then((code) => { process.exitCode = code; }, (err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
