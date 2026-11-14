import { describe, expect, it, vi } from 'vitest';
import { authReducer, gate, initials, initialAuth, wrapFetch, type AuthPhase } from './auth';

const staff = { id: 's1', email: 'ayanda@school.example', display_name: 'Ayanda Mokoena' };

describe('auth gate', () => {
  it('shows nothing of the app while /api/auth/me is loading', () => {
    expect(gate(initialAuth)).toBe('loading');
  });
  it('shows the error screen when /api/auth/me fails, never the app', () => {
    expect(gate({ kind: 'error', message: 'HTTP 502' })).toBe('error');
  });
  it('requires sign-in when the server requires it and nobody is signed in', () => {
    expect(gate({ kind: 'ready', me: { required: true, staff: null } })).toBe('signin');
  });
  it('opens the app when sign-in is not required', () => {
    expect(gate({ kind: 'ready', me: { required: false, staff: null } })).toBe('app');
  });
  it('opens the app for a signed-in staff member', () => {
    expect(gate({ kind: 'ready', me: { required: true, staff } })).toBe('app');
  });
});

describe('auth reducer', () => {
  const ready: AuthPhase = { kind: 'ready', me: { required: true, staff } };
  it('sign in then sign out returns to the sign-in screen', () => {
    const a = authReducer({ kind: 'ready', me: { required: true, staff: null } }, { type: 'signed-in', staff });
    expect(gate(a)).toBe('app');
    expect(gate(authReducer(a, { type: 'signed-out' }))).toBe('signin');
  });
  it('a 401 AUTH_REQUIRED from any call sends a signed-in session back to sign-in', () => {
    expect(gate(authReducer(ready, { type: 'auth-required' }))).toBe('signin');
  });
  it('retry goes back to loading', () => {
    expect(authReducer({ kind: 'error', message: 'x' }, { type: 'retry' })).toEqual({ kind: 'loading' });
  });
});

describe('wrapFetch', () => {
  const json = (status: number, b: unknown) =>
    new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  it('calls onRequired for 401 AUTH_REQUIRED on /api/*, and still returns the body', async () => {
    const onRequired = vi.fn();
    const f = wrapFetch((async () => json(401, { code: 'AUTH_REQUIRED' })) as typeof fetch, onRequired);
    const res = await f('/api/runs');
    expect(onRequired).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ code: 'AUTH_REQUIRED' });
  });
  it('ignores a wrong-password 401 from the login call', async () => {
    const onRequired = vi.fn();
    const f = wrapFetch((async () => json(401, { code: 'AUTH_REQUIRED', error: 'no' })) as typeof fetch, onRequired);
    await f('/api/auth/login', { method: 'POST' });
    expect(onRequired).not.toHaveBeenCalled();
  });
  it('ignores other errors', async () => {
    const onRequired = vi.fn();
    const f = wrapFetch((async () => json(500, { error: 'boom' })) as typeof fetch, onRequired);
    await f('/api/runs');
    expect(onRequired).not.toHaveBeenCalled();
  });
});

describe('initials', () => {
  it('uses first and last word', () => expect(initials('Ayanda Mokoena')).toBe('AM'));
  it('handles one word and empty', () => {
    expect(initials('ayanda')).toBe('A');
    expect(initials('  ')).toBe('?');
  });
});
