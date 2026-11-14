import { describe, expect, it } from 'vitest';
import { changedSessions, clashSessionIds, parseCsv, sourceLineAt } from './csv';

const V1 = [
  'session_id,trainee_id,mentor_id,day,start,status',
  'S1,T01,M-A,Mon,09:00,BOOKED',
  'S2,T02,M-B,Tue,10:00,BOOKED',
  'S3,T03,M-B,Tue,10:00,BOOKED',
  'S4,T04,M-A,Wed,14:00,BOOKED',
  'S5,T05,M-A,Wed,14:00,CANCELLED',
].join('\n');

const V2 = [
  'session_id,trainee_id,mentor_id,day,start,status',
  'S1,T01,M-A,Mon,09:00,BOOKED',
  'S2,T02,M-B,Wed,11:00,BOOKED',
  'S3,T03,M-B,Tue,10:00,BOOKED',
  'S4,T04,M-A,Wed,14:00,BOOKED',
  'S9,T09,M-A,Thu,08:00,BOOKED',
].join('\n');

describe('parseCsv', () => {
  it('reads quoted commas, doubled quotes and CRLF endings', () => {
    const t = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n1,2\r\n');
    expect(t.header).toEqual(['a', 'b']);
    expect(t.rows).toEqual([
      { a: 'x, y', b: 'say "hi"' },
      { a: '1', b: '2' },
    ]);
  });

  it('returns an empty table for empty text', () => {
    expect(parseCsv('')).toEqual({ header: [], rows: [] });
  });
});

describe('clashSessionIds', () => {
  it('finds both sessions of a double booking, sorted, ignoring cancelled rows', () => {
    expect(clashSessionIds(parseCsv(V1).rows)).toEqual(['S2', 'S3']);
  });

  it('returns nothing when no mentor is booked twice at one time', () => {
    expect(clashSessionIds(parseCsv(V2).rows)).toEqual([]);
  });
});

describe('changedSessions (v1 to v2)', () => {
  it('reports moved rows as changed, dropped rows as removed and new rows as added, each sorted', () => {
    expect(changedSessions(V1, V2)).toEqual({
      changed: ['S2'],
      removed: ['S5'],
      added: ['S9'],
    });
  });

  it('reports nothing for identical texts', () => {
    expect(changedSessions(V1, V1)).toEqual({ changed: [], removed: [], added: [] });
  });
});

describe('sourceLineAt', () => {
  it('returns the 1-based line without a trailing carriage return', () => {
    const text = 'h1,h2\r\nx,y\r\n';
    expect(sourceLineAt(text, 2)).toBe('x,y');
  });

  it('returns null past the end of the file', () => {
    expect(sourceLineAt('h\nx', 9)).toBeNull();
  });
});
