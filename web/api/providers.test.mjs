// Run: node --test web/api/providers.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeProviders } from './providers.mjs';

test('describeProviders never returns a key and marks configured by env presence', () => {
  const env = { MODEL_PROFILE: 'free', GROQ_API_KEY: 'gsk_secret_value' };
  const out = describeProviders(env);
  const text = JSON.stringify(out);
  assert.ok(!text.includes('gsk_secret_value'), 'key must not appear in output');
  const groq = out.providers.find((p) => p.name === 'groq');
  assert.equal(groq.configured, true);
  assert.equal(out.providers.find((p) => p.name === 'gemini').configured, false);
  assert.deepEqual(out.chain, ['groq']);
  assert.equal(out.profile, 'free');
});

test('default profile is demo and budget comes from env', () => {
  const out = describeProviders({ MODEL_RUN_MAX_USD: '0.25' });
  assert.equal(out.profile, 'demo');
  assert.equal(out.budget.maxUsd, 0.25);
  assert.deepEqual(out.chain, []);
});

test('pinned provider replaces the profile in the description', () => {
  const out = describeProviders({ MODEL_PROVIDER: 'groq', GROQ_API_KEY: 'x' });
  assert.equal(out.profile, 'pin:groq');
  assert.deepEqual(out.chain, ['groq']);
});
