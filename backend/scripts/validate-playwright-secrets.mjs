#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.join(repoRoot, '.env.playwright'), override: false });
dotenv.config({ path: path.join(repoRoot, 'backend', '.env.playwright'), override: false });
dotenv.config({ path: path.join(repoRoot, 'frontend', '.env.playwright'), override: false });

const credentialPairs = [
  ['TEST_USER', 'PLAYWRIGHT_TEST_USER_EMAIL', 'PLAYWRIGHT_TEST_USER_PASSWORD'],
  ['TEST_STAFF', 'PLAYWRIGHT_TEST_STAFF_EMAIL', 'PLAYWRIGHT_TEST_STAFF_PASSWORD'],
  ['TEST_INVITEE', 'PLAYWRIGHT_TEST_INVITEE_EMAIL', 'PLAYWRIGHT_TEST_INVITEE_PASSWORD'],
  ['TEST_ONBOARDING', 'PLAYWRIGHT_TEST_ONBOARDING_EMAIL', 'PLAYWRIGHT_TEST_ONBOARDING_PASSWORD'],
  ['TEST_BILLING', 'PLAYWRIGHT_TEST_BILLING_EMAIL', 'PLAYWRIGHT_TEST_BILLING_PASSWORD'],
];

const urlVars = [
  ['BASE_URL', 'PLAYWRIGHT_BASE_URL'],
  ['API_URL', 'PLAYWRIGHT_API_URL'],
];

const rows = [];
const errors = [];

for (const [label, emailKey, passwordKey] of credentialPairs) {
  const hasEmail = hasValue(emailKey);
  const hasPassword = hasValue(passwordKey);
  const status = hasEmail && hasPassword ? 'present' : hasEmail || hasPassword ? 'partial' : 'missing';

  rows.push({
    item: label,
    required: `${emailKey} + ${passwordKey}`,
    status,
  });

  if (status !== 'present') {
    errors.push(`${label} requires both ${emailKey} and ${passwordKey}.`);
  }
}

for (const [label, key] of urlVars) {
  const present = hasValue(key);
  rows.push({
    item: label,
    required: key,
    status: present ? 'present' : 'missing',
  });
  if (!present) {
    errors.push(`${key} is required.`);
  }
}

printTable(rows);

if (errors.length > 0) {
  console.error('\nPlaywright authenticated secret validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('\nPlaywright authenticated secret validation passed.');

function hasValue(key) {
  return Boolean(String(process.env[key] ?? '').trim());
}

function printTable(items) {
  const headers = ['Item', 'Required env vars', 'Status'];
  const widths = [
    Math.max(headers[0].length, ...items.map((row) => row.item.length)),
    Math.max(headers[1].length, ...items.map((row) => row.required.length)),
    Math.max(headers[2].length, ...items.map((row) => row.status.length)),
  ];

  console.log(formatRow(headers, widths));
  console.log(widths.map((width) => '-'.repeat(width)).join(' | '));
  for (const row of items) {
    console.log(formatRow([row.item, row.required, row.status], widths));
  }
}

function formatRow(values, widths) {
  return values.map((value, index) => String(value).padEnd(widths[index])).join(' | ');
}
