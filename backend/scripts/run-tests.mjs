#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env');
const childEnv = { ...process.env };

if (fs.existsSync(envPath)) {
  const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in childEnv)) {
      childEnv[key] = value;
    }
  }
}

childEnv.NODE_ENV = 'test';

const args = process.argv.slice(2);
const testArgs = args.length > 0 ? args : findDefaultTestFiles();

if (testArgs.length === 0) {
  console.error('Could not find any backend test files under src/.');
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...testArgs], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: childEnv,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

function findDefaultTestFiles() {
  const srcDir = path.join(repoRoot, 'src');
  return walkDir(srcDir)
    .filter((filePath) => filePath.endsWith('.test.js'))
    .map((filePath) => path.relative(repoRoot, filePath))
    .sort();
}

function walkDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return walkDir(entryPath);
    }
    return entry.isFile() ? [entryPath] : [];
  });
}
