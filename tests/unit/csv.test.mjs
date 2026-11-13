import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv, escapeCell } from '../../engine/csv.mjs';

test('quoted comma, newline and doubled quote are data', () => {
  const text = 'name,note\n"Lee, A","line one\nline ""two"""\nB,plain\n';
  const out = parseCsv(text);
  assert.deepEqual(out.header, ['name', 'note']);
  assert.deepEqual(out.rows, [
    { name: 'Lee, A', note: 'line one\nline "two"' },
    { name: 'B', note: 'plain' },
  ]);
});

test('CRLF line endings and leading UTF-8 BOM are handled', () => {
  const text = '﻿a,b\r\n1,2\r\n3,4\r\n';
  const out = parseCsv(text);
  assert.deepEqual(out.header, ['a', 'b']);
  assert.deepEqual(out.rows, [{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  assert.deepEqual(out.rowNumbers, [2, 3]);
});

test('empty cells are empty strings and trailing blank lines are ignored', () => {
  const out = parseCsv('a,b,c\n1,,3\n\n\n');
  assert.deepEqual(out.rows, [{ a: '1', b: '', c: '3' }]);
});

test('rowNumbers shift after a quoted newline', () => {
  const text = 'id,note\n1,"first\nsecond"\n2,plain\n3,"x\ny\nz"\n4,end\n';
  const out = parseCsv(text);
  assert.deepEqual(out.rowNumbers, [2, 4, 5, 8]);
  assert.deepEqual(out.rows.map((r) => r.id), ['1', '2', '3', '4']);
});

test('ragged row throws CSV_RAGGED and names the line', () => {
  assert.throws(
    () => parseCsv('a,b\n1,2\n3\n'),
    (err) => err.code === 'CSV_RAGGED' && /line 3/.test(err.message),
  );
});

test('unclosed quote throws CSV_UNCLOSED_QUOTE', () => {
  assert.throws(
    () => parseCsv('a,b\n1,"open\n2,3\n'),
    (err) => err.code === 'CSV_UNCLOSED_QUOTE',
  );
});

test('empty input throws CSV_EMPTY', () => {
  assert.throws(() => parseCsv(''), (err) => err.code === 'CSV_EMPTY');
  assert.throws(() => parseCsv('\n\n'), (err) => err.code === 'CSV_EMPTY');
});

test('duplicate header throws CSV_DUPLICATE_HEADER', () => {
  assert.throws(() => parseCsv('a,a\n1,2\n'), (err) => err.code === 'CSV_DUPLICATE_HEADER');
});

test('toCsv then parseCsv round-trips values with specials', () => {
  const header = ['id', 'text', 'n'];
  const rows = [
    { id: 'r1', text: 'comma, here', n: 4 },
    { id: 'r2', text: 'quote " and\nnewline', n: null },
    { id: 'r3', text: '  padded  ', n: undefined },
  ];
  const csv = toCsv(header, rows);
  assert.ok(csv.endsWith('\n'));
  const back = parseCsv(csv);
  assert.deepEqual(back.header, header);
  assert.deepEqual(back.rows, [
    { id: 'r1', text: 'comma, here', n: '4' },
    { id: 'r2', text: 'quote " and\nnewline', n: '' },
    { id: 'r3', text: '  padded  ', n: '' },
  ]);
});

test('formula guard prefixes =, @, + text but not plain numbers', () => {
  assert.equal(escapeCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(escapeCell('@x'), "'@x");
  assert.equal(escapeCell('+1+1'), "'+1+1");
  assert.equal(escapeCell('\tcmd'), "'\tcmd");
  assert.equal(escapeCell('-5'), '-5');
  assert.equal(escapeCell('3.2'), '3.2');
  assert.equal(escapeCell(-5), '-5');
  assert.equal(escapeCell(null), '');
});

test('toCsv applies the formula guard to cells and keeps header order', () => {
  const out = toCsv(['b', 'a'], [{ a: '=HYPERLINK("x")', b: '-5' }]);
  assert.equal(out, 'b,a\n-5,"\'=HYPERLINK(""x"")"\n');
});
