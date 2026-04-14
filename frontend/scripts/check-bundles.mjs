import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST_DIR = path.resolve('dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');
const MANIFEST_PATH = path.join(DIST_DIR, '.vite', 'manifest.json');
const INITIAL_JS_BUDGET_BYTES = 520 * 1024;
const INITIAL_CSS_BUDGET_BYTES = 320 * 1024;
const LARGEST_ASYNC_JS_BUDGET_BYTES = 900 * 1024;

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
const indexHtml = await readFile(INDEX_HTML_PATH, 'utf8');
const initialAssets = parseInitialAssets(indexHtml);
const initialJsSize = await sumFileSizes(initialAssets.js);
const initialCssSize = await sumFileSizes(initialAssets.css);

const asyncJsCandidates = Object.values(manifest)
  .map((chunk) => chunk.file)
  .filter((file) => file?.endsWith('.js') && !initialAssets.js.includes(file));
const asyncJsSizes = await Promise.all(asyncJsCandidates.map(async (file) => ({
  file,
  size: await getFileSize(file),
})));
const largestAsyncChunk = asyncJsSizes.sort((left, right) => right.size - left.size)[0] ?? { file: null, size: 0 };

if (initialJsSize > INITIAL_JS_BUDGET_BYTES) {
  throw new Error(
    `Initial JavaScript budget exceeded: ${(initialJsSize / 1024).toFixed(1)} KB > ${(INITIAL_JS_BUDGET_BYTES / 1024).toFixed(1)} KB.`,
  );
}

if (initialCssSize > INITIAL_CSS_BUDGET_BYTES) {
  throw new Error(
    `Initial CSS budget exceeded: ${(initialCssSize / 1024).toFixed(1)} KB > ${(INITIAL_CSS_BUDGET_BYTES / 1024).toFixed(1)} KB.`,
  );
}

if (largestAsyncChunk.size > LARGEST_ASYNC_JS_BUDGET_BYTES) {
  throw new Error(
    `Largest async JavaScript chunk exceeded budget: ${largestAsyncChunk.file} ${(largestAsyncChunk.size / 1024).toFixed(1)} KB > ${(LARGEST_ASYNC_JS_BUDGET_BYTES / 1024).toFixed(1)} KB.`,
  );
}

console.log(
  [
    'Bundle budgets passed.',
    `Initial JS ${(initialJsSize / 1024).toFixed(1)} KB.`,
    `Initial CSS ${(initialCssSize / 1024).toFixed(1)} KB.`,
    `Largest async JS ${largestAsyncChunk.file ?? 'n/a'} ${(largestAsyncChunk.size / 1024).toFixed(1)} KB.`,
  ].join(' '),
);

async function sumFileSizes(files) {
  const sizes = await Promise.all(files.map((file) => getFileSize(file)));
  return sizes.reduce((total, size) => total + size, 0);
}

async function getFileSize(relativeFile) {
  const filePath = path.join(DIST_DIR, relativeFile);
  const fileStat = await stat(filePath);
  return fileStat.size;
}

function parseInitialAssets(html) {
  const js = new Set();
  const css = new Set();

  for (const match of html.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g)) {
    js.add(match[1]);
  }

  for (const match of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+\.js)"/g)) {
    js.add(match[1]);
  }

  for (const match of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/([^"]+\.css)"/g)) {
    css.add(match[1]);
  }

  return {
    js: [...js],
    css: [...css],
  };
}
