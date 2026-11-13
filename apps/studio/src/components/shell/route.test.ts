import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash, routeRunId } from './route';

describe('hash routes', () => {
  it('parses each workspace route', () => {
    expect(parseRoute('#/mission/inject_overlap-20261113-120000')).toEqual({ name: 'mission', runId: 'inject_overlap-20261113-120000' });
    expect(parseRoute('#/mission')).toEqual({ name: 'mission', runId: null });
    expect(parseRoute('#/missions')).toEqual({ name: 'missions' });
    expect(parseRoute('#/agents')).toEqual({ name: 'agents' });
    expect(parseRoute('#/evidence/run-1')).toEqual({ name: 'evidence', runId: 'run-1' });
    expect(parseRoute('#/files/run-1')).toEqual({ name: 'files', runId: 'run-1' });
    expect(parseRoute('#/models')).toEqual({ name: 'models' });
  });

  it('unknown or empty hashes go home, and unsafe run ids are dropped', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/nope')).toEqual({ name: 'home' });
    expect(parseRoute('#/mission/../etc')).toEqual({ name: 'mission', runId: null });
    expect(parseRoute('#/mission/%00')).toEqual({ name: 'mission', runId: null });
  });

  it('formats and round-trips', () => {
    expect(routeHash({ name: 'mission', runId: 'a_b-1' })).toBe('#/mission/a_b-1');
    expect(parseRoute(routeHash({ name: 'files', runId: 'x' }))).toEqual({ name: 'files', runId: 'x' });
  });

  it('reports the run a route names', () => {
    expect(routeRunId({ name: 'mission', runId: 'r1' })).toBe('r1');
    expect(routeRunId({ name: 'models' })).toBeNull();
  });
});
