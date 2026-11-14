import { describe, expect, it } from 'vitest';
import { clashRows, parseCsv } from './FileDrawer';

describe('parseCsv', () => {
  it('handles quoted commas, doubled quotes and CRLF', () => {
    const { header, rows } = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n');
    expect(header).toEqual(['a', 'b']);
    expect(rows).toEqual([{ a: 'x, y', b: 'say "hi"' }]);
  });
});

describe('clashRows', () => {
  const row = (session: string, mentor: string, day: string, start: string, status = 'BOOKED') => ({
    session_id: session,
    mentor_id: mentor,
    day,
    start,
    status,
  });

  it('flags every BOOKED row that shares mentor, day and start', () => {
    const rows = [row('S1', 'M-A', 'Tue', '09:00'), row('S2', 'M-A', 'Tue', '09:00'), row('S3', 'M-A', 'Tue', '10:00')];
    expect([...clashRows(rows)].sort()).toEqual([0, 1]);
  });

  it('ignores rows that are not BOOKED', () => {
    const rows = [row('S1', 'M-A', 'Tue', '09:00'), row('S2', 'M-A', 'Tue', '09:00', 'UNSCHEDULED')];
    expect(clashRows(rows).size).toBe(0);
  });

  it('does not flag different mentors at the same time', () => {
    const rows = [row('S1', 'M-A', 'Tue', '09:00'), row('S2', 'M-B', 'Tue', '09:00')];
    expect(clashRows(rows).size).toBe(0);
  });
});
