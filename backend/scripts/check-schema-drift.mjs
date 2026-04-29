import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const sqlPath = path.join(repoRoot, 'database', 'schema.sql');
const drizzlePath = path.join(repoRoot, 'backend', 'src', 'db', 'schema.js');

const sqlSource = fs.readFileSync(sqlPath, 'utf8');
const drizzleSource = fs.readFileSync(drizzlePath, 'utf8');

const sqlTables = parseSqlTables(sqlSource);
const drizzleTables = parseDrizzleTables(drizzleSource);
const errors = [];

for (const [tableName, sqlColumns] of sqlTables) {
  const drizzleColumns = drizzleTables.get(tableName);
  if (!drizzleColumns) {
    errors.push(`Missing Drizzle table for SQL table "${tableName}".`);
    continue;
  }

  for (const column of sqlColumns) {
    if (!drizzleColumns.has(column)) {
      errors.push(`Missing Drizzle column "${tableName}.${column}".`);
    }
  }
}

for (const [tableName, drizzleColumns] of drizzleTables) {
  const sqlColumns = sqlTables.get(tableName);
  if (!sqlColumns) {
    errors.push(`Missing SQL table for Drizzle table "${tableName}".`);
    continue;
  }

  for (const column of drizzleColumns) {
    if (!sqlColumns.has(column)) {
      errors.push(`Missing SQL column "${tableName}.${column}".`);
    }
  }
}

if (errors.length > 0) {
  console.error('Schema drift detected between database/schema.sql and backend/src/db/schema.js:\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log('Schema drift check passed: SQL and Drizzle table/column names are aligned.');
}

function parseSqlTables(source) {
  const tables = new Map();
  const tableRegex = /CREATE TABLE(?: IF NOT EXISTS)?\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/g;
  let match;

  while ((match = tableRegex.exec(source))) {
    const [, tableName, body] = match;
    const columns = new Set();

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('--')) continue;
      if (/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE)\b/i.test(line)) continue;

      const columnMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+/);
      if (columnMatch) {
        columns.add(columnMatch[1]);
      }
    }

    tables.set(tableName, columns);
  }

  return tables;
}

function parseDrizzleTables(source) {
  const tables = new Map();
  const tableRegex = /pgTable\(\s*['"]([^'"]+)['"]\s*,/g;
  let match;

  while ((match = tableRegex.exec(source))) {
    const [, tableName] = match;
    const objectStart = source.indexOf('{', tableRegex.lastIndex);
    if (objectStart === -1) continue;
    const objectEnd = findMatchingBrace(source, objectStart);
    if (objectEnd === -1) continue;
    const body = source.slice(objectStart + 1, objectEnd);
    const columns = new Set();
    const columnRegex = /\b[a-zA-Z_$][\w$]*\s*:\s*[a-zA-Z_$][\w$]*\(\s*['"]([^'"]+)['"]/g;
    let columnMatch;

    while ((columnMatch = columnRegex.exec(body))) {
      columns.add(columnMatch[1]);
    }

    tables.set(tableName, columns);
    tableRegex.lastIndex = objectEnd + 1;
  }

  return tables;
}

function findMatchingBrace(source, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}
