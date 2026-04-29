#!/usr/bin/env node

import { validateMediaStorageConfiguration } from '../src/services/media-storage/index.js';

const args = process.argv.slice(2);
const mode = getArgValue('--mode') ?? process.env.NODE_ENV ?? 'development';
const scopeArg = getArgValue('--scope') ?? 'backend';
const scopes = scopeArg.split(',').map((value) => value.trim()).filter(Boolean);
const authRequired = hasFlag('--auth-required') || process.env.PLAYWRIGHT_AUTH_REQUIRED === 'true';

const errors = [];
const warnings = [];

if (scopes.includes('backend') || scopes.includes('all')) {
  validateBackendEnv(mode);
}

if (scopes.includes('frontend') || scopes.includes('all')) {
  validateFrontendEnv(mode);
}

if (scopes.includes('playwright') || scopes.includes('all')) {
  validatePlaywrightEnv({ authRequired });
}

if (warnings.length > 0) {
  for (const warning of warnings) {
    console.warn(`[warn] ${warning}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[error] ${error}`);
  }
  process.exit(1);
}

console.log(`[ok] Environment validation passed for scope=${scopeArg} mode=${mode}`);

function validateBackendEnv(currentMode) {
  requireValue('DATABASE_URL', 'backend');

  if (['staging', 'production'].includes(currentMode)) {
    for (const key of ['FRONTEND_URL', 'API_URL', 'CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET']) {
      requireValue(key, 'backend');
      rejectPlaceholder(key, 'backend');
    }

    for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ENCRYPTION_KEY']) {
      requireValue(key, 'backend');
      rejectPlaceholder(key, 'backend');
    }
  }

  if (hasConfigured('STRIPE_SECRET_KEY')) {
    rejectPlaceholder('STRIPE_SECRET_KEY', 'backend');
    for (const key of [
      'STRIPE_PRICE_SOLO',
      'STRIPE_PRICE_SOLO_QUARTERLY',
      'STRIPE_PRICE_SOLO_YEARLY',
      'STRIPE_PRICE_PRO',
      'STRIPE_PRICE_PRO_QUARTERLY',
      'STRIPE_PRICE_PRO_YEARLY',
      'STRIPE_PRICE_TEAMS',
      'STRIPE_PRICE_TEAMS_QUARTERLY',
      'STRIPE_PRICE_TEAMS_YEARLY',
      'STRIPE_PRICE_AGENCY',
      'STRIPE_PRICE_AGENCY_QUARTERLY',
      'STRIPE_PRICE_AGENCY_YEARLY',
      'STRIPE_PRICE_FOUNDING_SOLO',
      'STRIPE_PRICE_FOUNDING_SOLO_QUARTERLY',
      'STRIPE_PRICE_FOUNDING_SOLO_YEARLY',
      'STRIPE_PRICE_FOUNDING_PRO',
      'STRIPE_PRICE_FOUNDING_PRO_QUARTERLY',
      'STRIPE_PRICE_FOUNDING_PRO_YEARLY',
      'STRIPE_PRICE_FOUNDING_TEAMS',
      'STRIPE_PRICE_FOUNDING_TEAMS_QUARTERLY',
      'STRIPE_PRICE_FOUNDING_TEAMS_YEARLY',
      'STRIPE_PRICE_FOUNDING_AGENCY',
      'STRIPE_PRICE_FOUNDING_AGENCY_QUARTERLY',
      'STRIPE_PRICE_FOUNDING_AGENCY_YEARLY',
      'STRIPE_PRICE_EXEC_BOOST_1000',
      'STRIPE_PRICE_EXEC_100',
      'STRIPE_PRICE_EXEC_300',
      'STRIPE_PRICE_EXEC_700',
      'STRIPE_PRICE_VIDEO_PACK_SMALL',
      'STRIPE_PRICE_VIDEO_PACK_PRO',
      'STRIPE_PRICE_VIDEO_15',
      'STRIPE_PRICE_VIDEO_30',
      'STRIPE_PRICE_VIDEO_100',
      'STRIPE_PRICE_SEAT_ADDON',
      'STRIPE_WEBHOOK_SECRET',
    ]) {
      requireValue(key, 'backend');
      rejectPlaceholder(key, 'backend');
    }
  } else if (currentMode === 'production') {
    warnings.push('Stripe is not configured. Billing upgrade and portal flows will be unavailable.');
  }

  if (hasConfigured('RESEND_API_KEY')) {
    rejectPlaceholder('RESEND_API_KEY', 'backend');
    requireValue('EMAIL_FROM', 'backend');
  } else {
    warnings.push('Resend is not configured. Invitation and onboarding emails will not send.');
  }

  if (hasConfigured('GOOGLE_CLIENT_ID') || hasConfigured('NOTION_CLIENT_ID') || hasConfigured('SLACK_CLIENT_ID')) {
    requireValue('INTEGRATION_STATE_SECRET', 'backend');
    rejectPlaceholder('INTEGRATION_STATE_SECRET', 'backend');
    requireValue('ENCRYPTION_KEY', 'backend');
    rejectPlaceholder('ENCRYPTION_KEY', 'backend');
    if (!/^[a-fA-F0-9]{64}$/.test(String(process.env.ENCRYPTION_KEY ?? '').trim())) {
      errors.push('backend ENCRYPTION_KEY must be a 64-character hex string.');
    }
  }

  if (!hasConfigured('WREN_ESCALATION_EMAIL')) {
    warnings.push('WREN_ESCALATION_EMAIL is not configured. Escalations will be suppressed.');
  }

  const mediaStorageResult = validateMediaStorageConfiguration(process.env);
  errors.push(...mediaStorageResult.errors);
  warnings.push(...mediaStorageResult.warnings);

  if (mediaStorageResult.driver === 'cloudinary') {
    for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      requireValue(key, 'backend');
      rejectPlaceholder(key, 'backend');
    }
  }

  if (['staging', 'production'].includes(currentMode) && mediaStorageResult.driver === 'cloudinary') {
    requireValue('CLOUDINARY_FOLDER', 'backend');
  }
}

function validateFrontendEnv(currentMode) {
  if (!['staging', 'production'].includes(currentMode)) {
    return;
  }

  for (const key of ['VITE_CLERK_PUBLISHABLE_KEY', 'VITE_API_URL']) {
    requireValue(key, 'frontend');
    rejectPlaceholder(key, 'frontend');
  }

  if (hasConfigured('VITE_API_URL') && !/^https?:\/\//.test(process.env.VITE_API_URL)) {
    warnings.push('frontend VITE_API_URL should be an absolute URL for staging/production builds.');
  }
}

function validatePlaywrightEnv({ authRequired: shouldRequireAuth }) {
  for (const [emailKey, passwordKey, label] of getPlaywrightRolePairs()) {
    const hasEmail = hasConfigured(emailKey);
    const hasPassword = hasConfigured(passwordKey);

    if (hasEmail !== hasPassword) {
      errors.push(`playwright ${label} has a partial credential pair. Set both ${emailKey} and ${passwordKey}, or neither.`);
    }
  }

  if (!shouldRequireAuth) {
    const configured = [
      'PLAYWRIGHT_TEST_USER_EMAIL',
      'PLAYWRIGHT_TEST_STAFF_EMAIL',
      'PLAYWRIGHT_TEST_INVITEE_EMAIL',
      'PLAYWRIGHT_TEST_ONBOARDING_EMAIL',
      'PLAYWRIGHT_TEST_BILLING_EMAIL',
    ].filter((key) => hasConfigured(key));

    if (configured.length > 0 && !hasConfigured('PLAYWRIGHT_BASE_URL')) {
      warnings.push('PLAYWRIGHT_BASE_URL is not set. Authenticated Playwright will fall back to the local preview shell.');
    }
    if (configured.length > 0 && !hasConfigured('PLAYWRIGHT_API_URL') && !hasConfigured('VITE_API_URL')) {
      warnings.push('PLAYWRIGHT_API_URL or VITE_API_URL is not set. Authenticated API boundary tests will be skipped or fail setup.');
    }
    return;
  }

  requireValue('PLAYWRIGHT_BASE_URL', 'playwright');
  requireValue('PLAYWRIGHT_API_URL', 'playwright');

  for (const [emailKey, passwordKey, label] of getPlaywrightRolePairs()) {
    requireValue(emailKey, `playwright ${label}`);
    requireValue(passwordKey, `playwright ${label}`);
  }
}

function getPlaywrightRolePairs() {
  return [
    ['PLAYWRIGHT_TEST_USER_EMAIL', 'PLAYWRIGHT_TEST_USER_PASSWORD', 'owner user'],
    ['PLAYWRIGHT_TEST_STAFF_EMAIL', 'PLAYWRIGHT_TEST_STAFF_PASSWORD', 'staff user'],
    ['PLAYWRIGHT_TEST_INVITEE_EMAIL', 'PLAYWRIGHT_TEST_INVITEE_PASSWORD', 'invitee user'],
    ['PLAYWRIGHT_TEST_ONBOARDING_EMAIL', 'PLAYWRIGHT_TEST_ONBOARDING_PASSWORD', 'onboarding user'],
    ['PLAYWRIGHT_TEST_BILLING_EMAIL', 'PLAYWRIGHT_TEST_BILLING_PASSWORD', 'billing user'],
  ];
}

function requireValue(key, scopeLabel) {
  if (!String(process.env[key] ?? '').trim()) {
    errors.push(`${scopeLabel} ${key} is required.`);
  }
}

function rejectPlaceholder(key, scopeLabel) {
  const value = String(process.env[key] ?? '').trim();
  if (value && isPlaceholder(value)) {
    errors.push(`${scopeLabel} ${key} is still a placeholder value.`);
  }
}

function hasConfigured(key) {
  return Boolean(String(process.env[key] ?? '').trim());
}

function isPlaceholder(value) {
  return /xxxx|placeholder|your_|generate_a_long_random_secret/i.test(value);
}

function hasFlag(flag) {
  return args.includes(flag);
}

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
}
