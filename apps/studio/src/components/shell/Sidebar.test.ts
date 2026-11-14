import { describe, expect, it } from 'vitest';
import { footerLines } from './Sidebar';
import { initialMission, type Mission } from '@/state';

const base = (over: Partial<Mission>): Mission => ({ ...initialMission('r1'), ...over });

describe('sidebar footer comes from the run ledger', () => {
  it('says no run when none is open', () => {
    expect(footerLines(null).headline).toBe('No run open');
  });

  it('says Code only when the run had no model', () => {
    const f = footerLines(base({ agents: { mode: 'code', note: 'No model key configured' } }));
    expect(f.headline).toBe('Code only');
    expect(f.detail).toBe('No model key configured');
  });

  it('shows profile, chain, tokens so far and who answered, from modelCalls', () => {
    const f = footerLines(base({
      agents: { mode: 'model', profile: 'free', chain: ['groq', 'gemini'], provider: 'groq' },
      modelCalls: [
        { agent: 'goal', ok: true, ms: 10, total: 120, error: null, provider: 'groq' },
        { agent: 'team', ok: false, ms: 10, total: 0, error: 'MODEL_HTTP_429', provider: 'groq' },
        { agent: 'voice', ok: true, ms: 10, total: 80, error: null, provider: 'gemini' },
      ],
    }));
    expect(f.headline).toBe('Profile free');
    expect(f.detail).toContain('Chain groq → gemini');
    expect(f.detail).toContain('200 tokens so far');
    expect(f.detail).toContain('answered by groq, gemini');
  });

  it('says nobody answered yet when no call succeeded', () => {
    const f = footerLines(base({ agents: { mode: 'model', profile: 'demo', chain: ['meta'] } }));
    expect(f.detail).toContain('answered by nobody yet');
  });
});
