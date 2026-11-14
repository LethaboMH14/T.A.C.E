// Renders the inspector on the REAL ladder-1 ledger (state/__fixtures__/ladder.events.jsonl) to static markup.
// Checks what the user would read: the output file, the repairs, the review rounds and the run-again hint.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialMission, reduce } from '@/state/mission';
import type { LedgerEvent, Mission } from '@/state/types';
import { Inspector } from './Inspector';
import { RunAgainForm } from './RunAgainForm';

const FIXTURE = fileURLToPath(new URL('../../state/__fixtures__/ladder.events.jsonl', import.meta.url));
const events: LedgerEvent[] = readFileSync(FIXTURE, 'utf8')
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l) as LedgerEvent);
const m: Mission = events.reduce(reduce, initialMission('ladder-1'));

const render = (selection: Parameters<typeof Inspector>[0]['selection']) =>
  renderToStaticMarkup(<Inspector mission={m} selection={selection} onClose={() => {}} />);

describe('Inspector on the ladder-1 ledger', () => {
  it('scheduler node shows its output mentor-schedule.csv v1 and a real timeline', () => {
    const html = render({ type: 'node', id: 'mentor_schedule' });
    expect(html).toContain('mentor-schedule.csv');
    expect(html).toContain('artifacts/mentor-schedule.v1.csv');
    expect(html).toContain('COMPLETED');
    expect(html).toContain('Deterministic code');
    expect(html).toContain('No model was called');
  });

  it('repair node lists both repairs with their strategies', () => {
    const html = render({ type: 'node', id: 'repair' });
    expect(html).toContain('mentor-schedule.csv@v1');
    expect(html).toContain('shift_one_hour');
    expect(html).toContain('first_free_valid_slot');
  });

  it('review node lists 3 rounds', () => {
    const html = render({ type: 'node', id: 'review' });
    expect(html).toContain('Round 1');
    expect(html).toContain('Round 2');
    expect(html).toContain('Round 3');
  });

  it('check selection reuses the Evidence X-Ray for a real check id', () => {
    const html = render({ type: 'check', id: 'C04_schedule_no_overlap' });
    expect(html).toContain('Evidence X-Ray');
  });

  it('header offers run-again, and the form says it starts a new run and keeps this one', () => {
    expect(render({ type: 'node', id: 'deliver' })).toContain('Run again with a change');
    const form = renderToStaticMarkup(<RunAgainForm mission={m} />);
    expect(form).toContain('Starts a new run; this one stays as it is.');
    expect(form).toContain('Model off (deterministic code only)');
    expect(form).toContain('Mentor unavailable');
  });
});
