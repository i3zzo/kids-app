import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tipOfTheDay } from './tips.ts';

const tips = ['a', 'b', 'c', 'd', 'e'];

test('same child and day: same tip', () => {
  assert.equal(tipOfTheDay(tips, '2026-11-21', 'x'), tipOfTheDay(tips, '2026-11-21', 'x'));
});

test('tips change over a week', () => {
  const seen = new Set(['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'].map((d) => tipOfTheDay(tips, d, 'x')));
  assert.ok(seen.size >= 3, `only ${seen.size} different tips in a week`);
});

test('empty list: nothing', () => {
  assert.equal(tipOfTheDay([], '2026-11-21', 'x'), undefined);
});
