import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(backendRoot, '..');
const evidenceDir = path.resolve(repoRoot, 'docs', 'compliance', 'evidence-output');
const timestamp = new Date().toISOString().replace(/[:]/g, '-');
const outputPath = path.join(evidenceDir, `${timestamp}-security-evidence.local.md`);
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

mkdirSync(evidenceDir, { recursive: true });

function redact(text) {
  if (!text) {
    return '';
  }

  return String(text)
    .replace(/(authorization\s*:\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(cookie\s*:\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(database_url\s*=\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(clerk_[a-z_]*key\s*=\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(stripe_[a-z_]*secret\s*=\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(cloudinary_api_secret\s*=\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(encryption_key\s*=\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(integration_state_secret\s*=\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/postgres(?:ql)?:\/\/[^\s)'"`]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/\b(sk|pk|rk|whsec|tr_[a-z]+|AIza)[A-Za-z0-9_-]+\b/g, '[REDACTED_TOKEN]');
}

function runCommand(label, command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? backendRoot,
    env: options.env ?? process.env,
    shell: false,
    encoding: 'utf8',
  });

  const stdout = redact(result.stdout ?? '').trim();
  const stderr = redact(result.stderr ?? '').trim();

  return {
    label,
    command: [command, ...args].join(' '),
    exitCode: result.status ?? 1,
    stdout,
    stderr,
  };
}

function summarizeAudit(jsonText) {
  try {
    const report = JSON.parse(jsonText);
    const meta = report?.metadata?.vulnerabilities ?? {};
    return `info=${meta.info ?? 0}, low=${meta.low ?? 0}, moderate=${meta.moderate ?? 0}, high=${meta.high ?? 0}, critical=${meta.critical ?? 0}, total=${meta.total ?? 0}`;
  } catch {
    return 'Unable to parse audit JSON summary';
  }
}

function fileHash(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function fileTimestamp(filePath) {
  return statSync(filePath).mtime.toISOString();
}

function formatSection(title, lines) {
  return [`## ${title}`, '', ...lines, ''].join('\n');
}

function formatCommandResult(result, options = {}) {
  const lines = [
    `- Command: \`${result.command}\``,
    `- Exit code: \`${result.exitCode}\``,
  ];

  if (options.summary) {
    lines.push(`- Summary: ${options.summary}`);
  }

  const body = [];

  if (result.stdout) {
    body.push('```text', result.stdout, '```');
  }

  if (result.stderr) {
    body.push('```text', result.stderr, '```');
  }

  return [...lines, '', ...body];
}

const gitCommit = runCommand('Git commit', 'git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
const nodeVersion = runCommand('Node version', 'node', ['-v']);
const npmVersion = runCommand('npm version', npmBin, ['-v']);
const backendAudit = runCommand('Backend audit', npmBin, ['audit', '--omit=dev', '--json']);
const envValidate = runCommand('Env validation', npmBin, ['run', 'env:validate']);
const preflight = runCommand('Security preflight', npmBin, ['run', 'security:preflight']);
const rateLimitCheck = runCommand('Rate limit verification', 'node', ['scripts/verify-rate-limit-config.mjs']);
const mediaCheck = runCommand('Media storage verification', 'node', ['scripts/verify-media-storage-config.mjs']);
const headersCheck = process.env.API_URL
  ? runCommand('Security headers verification', 'node', ['scripts/verify-security-headers.mjs'], {
      env: {
        ...process.env,
        API_URL: process.env.API_URL,
      },
    })
  : null;

const optionalTests = process.env.PRYMAL_EVIDENCE_RUN_TESTS === 'true'
  ? runCommand('Backend tests', npmBin, ['test'])
  : null;

const backendLock = path.join(backendRoot, 'package-lock.json');
const frontendLock = path.join(repoRoot, 'frontend', 'package-lock.json');

const document = [
  '# Prymal Security Evidence Bundle',
  '',
  `- Generated at: \`${new Date().toISOString()}\``,
  `- Repo root: \`${repoRoot}\``,
  `- Output file: \`${outputPath}\``,
  '',
  '> This bundle is designed to avoid secrets. Do not paste live credentials or customer data into it manually.',
  '',
  formatSection('Release Context', [
    `- Git commit: \`${gitCommit.stdout || 'unknown'}\``,
    `- Node version: \`${nodeVersion.stdout || 'unknown'}\``,
    `- npm version: \`${npmVersion.stdout || 'unknown'}\``,
    `- Backend package-lock mtime: \`${fileTimestamp(backendLock)}\``,
    `- Backend package-lock sha256: \`${fileHash(backendLock)}\``,
    `- Frontend package-lock mtime: \`${fileTimestamp(frontendLock)}\``,
    `- Frontend package-lock sha256: \`${fileHash(frontendLock)}\``,
  ]),
  formatSection('Command Summaries', [
    ...formatCommandResult(backendAudit, { summary: summarizeAudit(backendAudit.stdout) }),
    ...formatCommandResult(envValidate),
    ...formatCommandResult(preflight),
    ...formatCommandResult(rateLimitCheck),
    ...formatCommandResult(mediaCheck),
    ...(headersCheck
      ? formatCommandResult(headersCheck)
      : ['- Security headers verification skipped because `API_URL` is not set in this process environment.', '']),
    ...(optionalTests
      ? formatCommandResult(optionalTests)
      : ['- Backend test summary skipped. Set `PRYMAL_EVIDENCE_RUN_TESTS=true` to include it.', '']),
  ]),
  formatSection('Follow-Up Evidence To Collect Outside Repo', [
    '- `ufw` screenshot from the VPS',
    '- `fail2ban` screenshot from the VPS',
    '- Cloudflare `Full (strict)` screenshot',
    '- GitHub, Clerk, Stripe, Cloudinary, OpenAI, Anthropic, Resend, VPS provider, and registrar MFA screenshots',
    '- Clerk and Stripe webhook health screenshots',
    '- backup restore test evidence record',
  ]),
].join('\n');

writeFileSync(outputPath, document, 'utf8');
console.log(`Security evidence written to ${outputPath}`);
