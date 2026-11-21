import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageInMonths, buildMessages, parseSSE } from './tipsPrompt.ts';

test('age in whole months', () => {
  assert.equal(ageInMonths('2026-01-15', new Date('2026-11-21T00:00:00Z')), 10);
  assert.equal(ageInMonths('2026-01-25', new Date('2026-11-21T00:00:00Z')), 9);
});

test('the AI never receives the child name or birth date', () => {
  const msgs = buildMessages({
    ageMonths: 7,
    gender: 'girl',
    section: 'sleep',
    lang: 'en',
    tips: [{ title_en: 'Two naps', body_en: 'Many babies take two naps.', title_ar: 'قيلولتان', body_ar: '...' }],
  });
  const all = JSON.stringify(msgs);
  assert.match(all, /7 months old, girl/);
  assert.doesNotMatch(all, /\d{4}-\d{2}-\d{2}/);
  assert.match(msgs[0].content, /ONLY the information in the reviewed tips/);
  assert.match(msgs[0].content, /Never diagnose/);
});

test('Arabic replies use the Arabic tip text', () => {
  const msgs = buildMessages({ ageMonths: 30, gender: 'boy', section: 'feeding', lang: 'ar', tips: [{ title_en: 'x', body_en: 'y', title_ar: 'تنوع', body_ar: 'قدّم خضاراً' }] });
  assert.match(msgs[0].content, /Arabic/);
  assert.match(msgs[1].content, /قدّم خضاراً/);
});

test('event stream parsing keeps partial lines for the next chunk', () => {
  const [p1, rest1] = parseSSE('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"del');
  assert.deepEqual(p1, ['Hel']);
  const [p2, , done] = parseSSE(rest1 + 'ta":{"content":"lo"}}]}\n\ndata: [DONE]\n');
  assert.deepEqual(p2, ['lo']);
  assert.equal(done, true);
});
