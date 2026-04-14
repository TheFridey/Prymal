import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST_DIR = path.resolve('dist', 'assets');
const JS_BUDGET_BYTES = 550 * 1024;
const CSS_BUDGET_BYTES = 220 * 1024;

const entries = await readdir(DIST_DIR);
const assetSizes = await Promise.all(
  entries.map(async (entry) => {
    const filePath = path.join(DIST_DIR, entry);
    const fileStat = await stat(filePath);
    return { entry, size: fileStat.size };
  }),
);

const totalJs = assetSizes
  .filter((asset) => asset.entry.endsWith('.js'))
  .reduce((sum, asset) => sum + asset.size, 0);
const totalCss = assetSizes
  .filter((asset) => asset.entry.endsWith('.css'))
  .reduce((sum, asset) => sum + asset.size, 0);

if (totalJs > JS_BUDGET_BYTES) {
  throw new Error(`JavaScript bundle budget exceeded: ${(totalJs / 1024).toFixed(1)} KB > ${(JS_BUDGET_BYTES / 1024).toFixed(1)} KB`);
}

if (totalCss > CSS_BUDGET_BYTES) {
  throw new Error(`CSS bundle budget exceeded: ${(totalCss / 1024).toFixed(1)} KB > ${(CSS_BUDGET_BYTES / 1024).toFixed(1)} KB`);
}

console.log(`Bundle budgets passed. JS ${(totalJs / 1024).toFixed(1)} KB, CSS ${(totalCss / 1024).toFixed(1)} KB.`);
