import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice, mapLink, NEED_FILTERS, tagsForNeed } from './places.ts';

test('no published price shows nothing', () => {
  assert.equal(formatPrice({ price_min_kwd: null, price_max_kwd: null, price_unit: null }, 'en'), null);
});

test('a single price with a period', () => {
  assert.equal(formatPrice({ price_min_kwd: 2400, price_max_kwd: null, price_unit: 'year' }, 'en'), 'KD 2,400 a year');
  assert.equal(formatPrice({ price_min_kwd: '4.75', price_max_kwd: null, price_unit: 'hour' }, 'en'), 'KD 4.75 an hour');
});

test('a range, and a price whose period the source does not give', () => {
  assert.equal(formatPrice({ price_min_kwd: 0.5, price_max_kwd: 1, price_unit: null }, 'en'), 'KD 0.5–1');
  assert.equal(formatPrice({ price_min_kwd: 5, price_max_kwd: 5, price_unit: 'entry' }, 'en'), 'KD 5 entry');
});

test('Arabic uses د.ك', () => {
  assert.match(formatPrice({ price_min_kwd: 14, price_max_kwd: null, price_unit: 'entry' }, 'ar')!, /د\.ك للدخول$/);
});

test('map link falls back to a search for the name and area', () => {
  assert.equal(mapLink({ maps_url: 'https://maps.example/x', name_en: 'A', area_en: null }), 'https://maps.example/x');
  assert.equal(
    mapLink({ maps_url: null, name_en: 'KidZania Kuwait', area_en: 'Al-Rai' }),
    'https://www.google.com/maps/search/?api=1&query=KidZania%20Kuwait%2C%20Al-Rai%2C%20Kuwait',
  );
});

test('picking one need also finds places for all disabilities', () => {
  assert.deepEqual(tagsForNeed('autism'), ['autism', 'all_needs']);
  assert.deepEqual(tagsForNeed('wheelchair_access'), ['wheelchair_access']);
});

test("the catch-all tags aren't offered as filters", () => {
  assert.ok(!NEED_FILTERS.includes('all_needs'));
  assert.ok(!NEED_FILTERS.includes('general'));
  assert.ok(NEED_FILTERS.includes('down_syndrome'));
});
