// Per-device session. Tokens stay in this browser only. Every access is guarded: storage can be blocked.
const CURRENT = 'tace.lms.current';
const sessionKey = (id: string) => `tace.lms.session.${id}`;

export interface Session {
  id: string;
  kind: 'learner' | 'mentor';
  token: string;
}

const read = (k: string): string | null => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  } catch {
    /* storage unavailable: the session lasts for this page only */
  }
};

export function saveSession(s: Session) {
  write(sessionKey(s.id), JSON.stringify(s));
  write(CURRENT, s.id);
}

export function getSession(id?: string): Session | null {
  const who = id ?? read(CURRENT);
  if (!who) return null;
  const raw = read(sessionKey(who));
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    return s.token && s.id ? s : null;
  } catch {
    return null;
  }
}

export function clearSession(id: string) {
  write(sessionKey(id), null);
  if (read(CURRENT) === id) write(CURRENT, null);
}

// One-line notices carried across a redirect (for example "Please log in again").
let flash: string | null = null;
export const setFlash = (m: string) => {
  flash = m;
};
export const takeFlash = (): string | null => {
  const m = flash;
  flash = null;
  return m;
};

// Read without clearing (React StrictMode runs initialisers twice in development). Clear after the screen mounts.
export const peekFlash = (): string | null => flash;
export const clearFlash = () => {
  flash = null;
};
