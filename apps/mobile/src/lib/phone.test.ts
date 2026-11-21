import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toKuwaitE164 } from './phone.ts';
import { ageParts, isValidDay, monthGrid, toDay } from './dates.ts';

test('accepts Kuwaiti mobile numbers in common formats', () => {
  assert.equal(toKuwaitE164('5000 0001'), '+96550000001');
  assert.equal(toKuwaitE164('+965 9999 1234'), '+96599991234');
  assert.equal(toKuwaitE164('0096566661234'), '+96566661234');
  assert.equal(toKuwaitE164('٥٠٠٠٠٠٠١'), '+96550000001');
});

test('rejects numbers that are not Kuwaiti mobiles', () => {
  assert.equal(toKuwaitE164('2222 3333'), null); // landline
  assert.equal(toKuwaitE164('5000'), null);
  assert.equal(toKuwaitE164('+971501234567'), null);
});

test('date helpers', () => {
  assert.equal(isValidDay('2026-02-30'), false);
  assert.equal(isValidDay('2026-02-28'), true);
  assert.deepEqual(ageParts('2025-08-21', new Date(2026, 10, 21)), { years: 1, months: 3 });
  assert.deepEqual(ageParts('2026-10-22', new Date(2026, 10, 21)), { years: 0, months: 0 });
  const grid = monthGrid(2026, 10); // November 2026
  assert.equal(grid.length, 42);
  assert.equal(grid[0].getDay(), 0); // starts on Sunday
  assert.equal(toDay(grid[0]), '2026-11-01');
});
