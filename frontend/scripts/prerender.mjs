// Static prerender for all public marketing routes.
//
// After `vite build`, this serves dist/ locally, drives a headless Chromium
// over every public route, waits for the SPA to render its content + inject
// its SEO (title, meta, canonical, OpenGraph, JSON-LD via PageMeta/JsonLd
// effects), and snapshots the fully-rendered HTML to dist/<route>/index.html.
//
// The module script is preserved in the snapshot, so real users still get the
// live SPA (main.jsx uses createRoot, which re-renders over the baked markup —
// no hydration-mismatch risk). Crawlers and AI answer engines read the static
// HTML without executing JavaScript.
//
// If the build was produced with a placeholder Clerk key, the app renders its
// setup card instead of marketing content; we detect that and skip prerender
// cleanly (exit 0) so CI stays green. Production builds carry the real key.

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { getPublicRoutes } from './lib/public-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const distDir = path.join(frontendRoot, 'dist');
const HOST = '127.0.0.1';
const CONCURRENCY = 3;
const NAV_TIMEOUT = 30_000;
const CONTENT_TIMEOUT = 12_000;
// Headless stability: the home hero uses three.js/WebGL which can crash GPU-less
// headless Chromium under concurrency. We disable the GPU (content still renders
// in the DOM) and harden the sandbox/shared-memory flags for CI containers.
const LAUNCH_ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function outputPathFor(routePath) {
  if (routePath === '/') return path.join(distDir, 'index.html');
  const clean = routePath.replace(/^\/+|\/+$/g, '');
  return path.join(distDir, clean, 'index.html');
}

// Serve dist/ like nginx try_files: real files win, everything else falls back
// to the original SPA shell. Prerendered output is written only AFTER the crawl,
// so the fallback shell is used throughout and never self-pollutes.
function startServer(shellHtml) {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const candidate = path.join(distDir, urlPath);
      const normalized = path.normalize(candidate);
      if (!normalized.startsWith(distDir)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      if (urlPath !== '/' && existsSync(normalized) && !normalized.endsWith(path.sep)) {
        const ext = path.extname(normalized).toLowerCase();
        // Static asset (has an extension we recognise) → serve the real file.
        if (ext && MIME[ext]) {
          const body = await readFile(normalized);
          res.writeHead(200, { 'content-type': MIME[ext] }).end(body);
          return;
        }
      }
      // Navigation route → original SPA shell.
      res.writeHead(200, { 'content-type': MIME['.html'] }).end(shellHtml);
    } catch (error) {
      res.writeHead(500).end(String(error));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, HOST, () => resolve(server));
  });
}

const DEFAULT_TITLE = 'Prymal | AI operating system for business execution';

// page.close() can hang indefinitely on Windows headless Chromium; bound it so a
// single stuck page can never stall the render pool.
async function closePage(page) {
  if (!page) return;
  await Promise.race([
    page.close().catch(() => {}),
    new Promise((resolve) => { setTimeout(resolve, 3_000); }),
  ]);
}

async function renderRoute(context, baseUrl, routePath) {
  let page;
  try {
    page = await context.newPage();
    await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });

    // Detect the Clerk setup gate (placeholder key build).
    const isSetupGate = await page.evaluate(() =>
      document.body?.innerText?.includes('VITE_CLERK_PUBLISHABLE_KEY') ?? false,
    );
    if (isSetupGate) {
      await closePage(page);
      return { routePath, status: 'setup-gate' };
    }

    // Wait for meaningful rendered content to appear: a non-empty heading, or
    // a substantial body of text (covers pages whose primary heading lives
    // outside #root). Timeout is swallowed so a slow route still gets snapshotted.
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        if (!root) return false;
        const h1 = root.querySelector('h1');
        const hasHeading = h1 && h1.textContent.trim().length > 0;
        const text = (root.innerText || '').trim().length;
        return (hasHeading && text > 150) || text > 400;
      },
      { timeout: CONTENT_TIMEOUT },
    ).catch(() => {});

    // Let PageMeta/JsonLd effects flush and entrance animations settle to opacity:1.
    await page.waitForTimeout(700);

    const html = await page.evaluate(() => `<!DOCTYPE html>\n${document.documentElement.outerHTML}`);
    const title = await page.title();
    const hasJsonLd = await page.evaluate(
      () => document.querySelectorAll('script[type="application/ld+json"]').length,
    );
    await closePage(page);

    const outPath = outputPathFor(routePath);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, html, 'utf8');
    console.log(`[prerender] ok  ${routePath}  (${hasJsonLd} JSON-LD, ${(html.length / 1024).toFixed(0)}kb)`);
    return {
      routePath,
      status: 'ok',
      titleChanged: title !== DEFAULT_TITLE,
      jsonLd: hasJsonLd,
      bytes: html.length,
    };
  } catch (error) {
    await closePage(page);
    console.warn(`[prerender] ERR ${routePath}: ${String(error?.message || error)}`);
    return { routePath, status: 'error', error: String(error?.message || error) };
  }
}

async function runPool(items, worker, size) {
  const results = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      results.push(await worker(current));
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  if (process.env.PRERENDER === '0') {
    console.log('[prerender] skipped (PRERENDER=0).');
    return;
  }
  const shellPath = path.join(distDir, 'index.html');
  if (!existsSync(shellPath)) {
    console.error('[prerender] dist/index.html not found — run `vite build` first.');
    process.exitCode = 1;
    return;
  }

  const { publicPaths } = getPublicRoutes();
  const shellHtml = await readFile(shellPath, 'utf8');
  const server = await startServer(shellHtml);
  const { port } = server.address();
  const baseUrl = `http://${HOST}:${port}`;

  const newSession = async () => {
    const browser = await chromium.launch({ args: LAUNCH_ARGS });
    const context = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 1280, height: 900 },
    });
    return { browser, context };
  };

  let session = await newSession();

  // Always release the headless browser and the static server, even on error,
  // so the build process can exit cleanly.
  try {
    console.log(`[prerender] rendering ${publicPaths.length} routes from ${baseUrl} ...`);

    // Probe the home route first to fail fast on the setup gate.
    const probe = await renderRoute(session.context, baseUrl, '/');
    if (probe.status === 'setup-gate') {
      console.warn(
        '[prerender] Clerk setup gate detected (placeholder VITE_CLERK_PUBLISHABLE_KEY).\n'
        + '[prerender] Skipping prerender — shipping SPA shell. Provide a real key to prerender.',
      );
      return;
    }

    const remaining = publicPaths.filter((p) => p !== '/');
    let results = [probe, ...(await runPool(remaining, (p) => renderRoute(session.context, baseUrl, p), CONCURRENCY))];

    // If the browser crashed mid-run (e.g. a GPU-less WebGL fault), relaunch once
    // and retry the affected routes sequentially before giving up.
    const isCrash = (r) => r.status === 'error' && /closed|crash|disconnected/i.test(r.error || '');
    if (results.some(isCrash)) {
      await session.browser.close().catch(() => {});
      session = await newSession();
      const retryPaths = results.filter(isCrash).map((r) => r.routePath);
      console.warn(`[prerender] relaunching browser to retry ${retryPaths.length} route(s) after a crash.`);
      const retried = await runPool(retryPaths, (p) => renderRoute(session.context, baseUrl, p), 1);
      const byPath = new Map(retried.map((r) => [r.routePath, r]));
      results = results.map((r) => (isCrash(r) && byPath.has(r.routePath) ? byPath.get(r.routePath) : r));
    }

    const ok = results.filter((r) => r.status === 'ok');
    const errored = results.filter((r) => r.status === 'error');
    const noJsonLd = ok.filter((r) => !r.jsonLd);

    console.log(`[prerender] done: ${ok.length} rendered, ${errored.length} errored.`);
    if (noJsonLd.length) {
      console.warn(`[prerender] ${noJsonLd.length} route(s) without JSON-LD: ${noJsonLd.map((r) => r.routePath).join(', ')}`);
    }
    if (errored.length) {
      for (const r of errored) console.error(`[prerender] ERROR ${r.routePath}: ${r.error}`);
      process.exitCode = 1;
    }
  } finally {
    // browser.close() can hang on Windows when helper subprocesses linger; bound it.
    await Promise.race([
      session.browser.close().catch(() => {}),
      new Promise((resolve) => { setTimeout(resolve, 5_000); }),
    ]);
    server.close();
  }
}

main()
  .catch((error) => {
    console.error('[prerender] fatal:', error);
    process.exitCode = 1;
  })
  // Force exit: a lingering headless browser subprocess can otherwise keep the
  // Node event loop alive and stall the build. All output is already written.
  .finally(() => process.exit(process.exitCode ?? 0));
