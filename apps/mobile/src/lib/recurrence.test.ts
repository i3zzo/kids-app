import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occurrencesBetween } from './recurrence.ts';

const d = (s: string) => new Date(s);
const days = (xs: Date[]) => xs.map((x) => `${x.getMonth() + 1}/${x.getDate()}`);

test('one-off event shows only on its day', () => {
  assert.equal(occurrencesBetween('2026-11-05T16:00:00', 'none', null, d('2026-11-01T00:00'), d('2026-12-01T00:00')).length, 1);
  assert.equal(occurrencesBetween('2026-10-05T16:00:00', 'none', null, d('2026-11-01T00:00'), d('2026-12-01T00:00')).length, 0);
});

test('weekly event repeats every 7 days, keeps its time', () => {
  const xs = occurrencesBetween('2026-10-01T16:30:00', 'weekly', null, d('2026-11-01T00:00'), d('2026-12-01T00:00'));
  assert.deepEqual(days(xs), ['11/5', '11/12', '11/19', '11/26']);
  assert.ok(xs.every((x) => x.getHours() === 16 && x.getMinutes() === 30));
});

test('repeat stops after the "until" day (inclusive)', () => {
  const xs = occurrencesBetween('2026-11-02T08:00:00', 'daily', '2026-11-04', d('2026-11-01T00:00'), d('2026-12-01T00:00'));
  assert.deepEqual(days(xs), ['11/2', '11/3', '11/4']);
});

test('monthly on the 31st falls on the last day of short months', () => {
  const xs = occurrencesBetween('2026-01-31T10:00:00', 'monthly', null, d('2026-02-01T00:00'), d('2026-05-01T00:00'));
  assert.deepEqual(days(xs), ['2/28', '3/31', '4/30']);
});

test('daily event far in the past does not loop from the start', () => {
  const xs = occurrencesBetween('2021-01-01T07:00:00', 'daily', null, d('2026-11-01T00:00'), d('2026-11-08T00:00'));
  assert.equal(xs.length, 7);
});

test('expandEvents merges one-off and repeating events in time order', async () => {
  const { expandEvents } = await import('./recurrence.ts');
  const xs = expandEvents(
    [
      { id: 'a', starts_at: '2026-11-03T10:00:00', repeat: 'weekly' as const, repeat_until: '2026-11-17' },
      { id: 'b', starts_at: '2026-11-04T09:00:00', repeat: 'none' as const, repeat_until: null },
    ],
    d('2026-11-01T00:00'),
    d('2026-12-01T00:00'),
  );
  assert.deepEqual(xs.map((x) => x.id), ['a', 'b', 'a', 'a']);
  assert.equal(new Set(xs.map((x) => x.key)).size, 4);
});
