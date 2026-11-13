// Creates the LMS admin token for THIS laptop's T.A.C.E server.
// Writes LMS_ADMIN_TOKEN (secret), LMS_URL and LMS_PUBLISHABLE_KEY (public by design) into repo/.env
// (git-ignored) and prints ONLY the sha256 of the token, which is what the database stores.
// Usage: node tools/lms/admin-token.mjs <supabase-url> <publishable-key>
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const [url, key] = process.argv.slice(2);
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url || '') || !key) { console.error('usage: node tools/lms/admin-token.mjs <https://ref.supabase.co> <publishable-key>'); process.exit(1); }
const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
const token = crypto.randomBytes(32).toString('hex');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const set = (name, value) => {
  const line = `${name}=${value}`;
  env = new RegExp(`^${name}=.*$`, 'm').test(env) ? env.replace(new RegExp(`^${name}=.*$`, 'm'), line) : `${env.replace(/\n?$/, '\n')}${line}\n`;
};
set('LMS_URL', url);
set('LMS_PUBLISHABLE_KEY', key);
set('LMS_ADMIN_TOKEN', token);
fs.writeFileSync(envPath, env);
console.log(crypto.createHash('sha256').update(token, 'utf8').digest('hex'));
