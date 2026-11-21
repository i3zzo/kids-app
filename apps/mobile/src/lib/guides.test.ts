import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideFits } from './guides.ts';

test('Kuwaiti families get Kuwaiti and general guides', () => {
  assert.equal(guideFits('kuwaiti', 'kuwaiti'), true);
  assert.equal(guideFits('all', 'kuwaiti'), true);
  assert.equal(guideFits('resident', 'kuwaiti'), false);
});

test('GCC and other residents get resident and general guides', () => {
  for (const n of ['gcc', 'other'] as const) {
    assert.equal(guideFits('resident', n), true);
    assert.equal(guideFits('all', n), true);
    assert.equal(guideFits('kuwaiti', n), false);
  }
});

test('nationality not set: every guide shows', () => {
  assert.equal(guideFits('kuwaiti', null), true);
  assert.equal(guideFits('resident', undefined), true);
});
