#!/usr/bin/env node
// Makes sign-in numbers for testers of the hosted TEST server, so they can log in
// without a real SMS. Each tester gets their own number (= their own account and
// family), with its own random 6-digit code.
//
//   node scripts/test-env/make-test-numbers.mjs 20 > testers.csv
//
// Prints a CSV (tester, number, code) to stdout and, on stderr, the one line to
// paste into Supabase: Authentication > Sign In / Providers > Phone >
// "Test Phone Numbers and OTPs".
//
// Never use these on the production server, and keep the CSV out of git: anyone
// with a number and its code can open that tester's account on the test server.
import { randomInt } from 'node:crypto';

const count = Math.min(Math.max(Number(process.argv[2] ?? 20), 1), 99);
// +965 5000 01NN. Local development already uses 5000 0001-0003 (config.toml),
// so these never clash with it. Kuwaiti format, so the sign-up rule
// (hook_before_user_created) accepts them.
const rows = [];
for (let i = 1; i <= count; i++) {
  const local = `500001${String(i).padStart(2, '0')}`;
  rows.push({ tester: `Tester ${i}`, local, e164: `965${local}`, code: String(randomInt(0, 1_000_000)).padStart(6, '0') });
}

console.log('tester,number_to_type,code');
for (const r of rows) console.log(`${r.tester},${r.local.slice(0, 4)} ${r.local.slice(4)},${r.code}`);

console.error('\nPaste this into Supabase > Authentication > Sign In / Providers > Phone > Test Phone Numbers and OTPs:\n');
console.error(rows.map((r) => `${r.e164}=${r.code}`).join(','));
