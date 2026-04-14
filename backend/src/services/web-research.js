import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const MAX_URLS_PER_REQUEST = 3;
const MAX_SEARCH_RESULTS = 3;
const MAX_INTERNAL_LINKS = 2;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_CONTENT_CHARS = 12_000;
const SCREENSHOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../runtime/webshots');

export async function fetchLiveWebContext(userMessage) {
  const directUrls = extractUrls(userMessage).slice(0, MAX_URLS_PER_REQUEST);
  const wantsBrowserAutomation = shouldUseBrowserAutomation(userMessage);
  const wantsScreenshot = shouldCaptureScreenshot(userMessage);

  if (directUrls.length > 0) {
    return fetchPages(directUrls, {
      mode: 'direct',
      wantsBrowserAutomation,
      wantsScreenshot,
    });
  }

  if (!shouldUseWebSearch(userMessage)) {
    return [];
  }

  const searchResults = await searchWeb(userMessage);

  if (searchResults.length === 0) {
    return [];
  }

  return fetchPages(
    searchResults.slice(0, MAX_SEARCH_RESULTS).map((result) => result.url),
    {
      mode: 'search',
      wantsBrowserAutomation,
      wantsScreenshot,
      seedResults: searchResults,
    },
  );
}

export async function readWebAsset(fileName) {
  const safeName = path.basename(fileName);
  const assetPath = path.join(SCREENSHOT_DIR, safeName);
  return readFile(assetPath);
}

async function fetchPages(urls, options) {
  const results = [];

  for (const url of urls) {
    try {
      const page = await fetchResearchBundle(url, options);
      results.push(page);
    } catch (error) {
      const seed = options.seedResults?.find((result) => result.url === url);
      results.push({
        url,
        title: seed?.title ?? safeHostname(url),
        content: '',
        summary: '',
        snippet: seed?.snippet ?? '',
        mode: options.mode,
        fetchedVia: 'fetch',
        screenshotUrl: null,
        followedLinks: [],
        error: error.message || 'Unable to fetch this URL.',
      });
    }
  }

  return results;
}

async function fetchResearchBundle(url, options) {
  const primaryPage = await fetchPageWithFallback(url, options);
  const followedLinks = await fetchInternalLinks(primaryPage, options);

  const combinedSections = [
    primaryPage.content,
    ...followedLinks.map((link, index) => `[FOLLOWED LINK ${index + 1}] ${link.title}\nURL: ${link.url}\n${link.summary}`),
  ]
    .filter(Boolean)
    .join('\n\n');

  const summary = combinedSections.slice(0, MAX_CONTENT_CHARS);
  const seed = options.seedResults?.find((result) => result.url === primaryPage.url || result.url === url);

  return {
    ...primaryPage,
    mode: options.mode,
    snippet: seed?.snippet ?? '',
    searchTitle: seed?.title ?? null,
    followedLinks: followedLinks.map((link) => ({
      title: link.title,
      url: link.url,
      summary: link.summary,
      fetchedVia: link.fetchedVia,
    })),
    summary,
  };
}

async function fetchPageWithFallback(url, options) {
  try {
    const staticPage = await fetchPageContent(url);

    if (shouldEscalateToBrowser(staticPage, options.wantsBrowserAutomation)) {
      const browserPage = await fetchPageInBrowser(url, { screenshot: options.wantsScreenshot });
      return browserPage ?? staticPage;
    }

    return staticPage;
  } catch (error) {
    if (options.wantsBrowserAutomation) {
      const browserPage = await fetchPageInBrowser(url, { screenshot: options.wantsScreenshot });

      if (browserPage) {
        return browserPage;
      }
    }

    throw error;
  }
}

async function fetchInternalLinks(page, options) {
  if (!page.html) {
    return [];
  }

  const links = extractInternalLinks(page.html, page.url).slice(0, MAX_INTERNAL_LINKS);
  const results = [];

  for (const link of links) {
    try {
      const child = await fetchPageWithFallback(link.url, {
        ...options,
        wantsScreenshot: false,
      });
      results.push({
        title: child.title,
        url: child.url,
        summary: child.summary,
        fetchedVia: child.fetchedVia,
      });
    } catch {}
  }

  return results;
}

function extractUrls(text) {
  if (!text) {
    return [];
  }

  const explicitMatches = text.match(/\bhttps?:\/\/[^\s<>"'`]+/gi) ?? [];
  const bareDomainMatches = text.match(/\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi) ?? [];
  const unique = new Set();

  for (const rawMatch of [...explicitMatches, ...bareDomainMatches]) {
    const cleaned = rawMatch.replace(/[),.;!?]+$/, '');
    const candidate = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;

    try {
      const url = new URL(candidate);

      if (!['http:', 'https:'].includes(url.protocol)) {
        continue;
      }

      if (isBlockedHostname(url.hostname)) {
        continue;
      }

      unique.add(url.toString());
    } catch {}
  }

  return Array.from(unique);
}

function shouldUseWebSearch(text) {
  if (!text?.trim()) {
    return false;
  }

  if (extractUrls(text).length > 0) {
    return true;
  }

  return /\b(search|look up|lookup|research|find|check|visit|browse|latest|current|today|news|website|site|online|review|compare)\b/i.test(
    text,
  );
}

function shouldUseBrowserAutomation(text) {
  return /\b(screenshot|screen shot|render|browser|js-heavy|javascript|spa|app|open the page|navigate)\b/i.test(
    text ?? '',
  );
}

function shouldCaptureScreenshot(text) {
  return /\b(screenshot|screen shot|show me the page|visual|rendered)\b/i.test(text ?? '');
}

async function searchWeb(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'PRYMAL/1.0 (+https://prymal.io)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`Search returned ${response.status}.`);
    }

    const html = await response.text();
    return parseDuckDuckGoResults(html);
  } finally {
    clearTimeout(timeout);
  }
}

function parseDuckDuckGoResults(html) {
  const results = [];
  const pattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = pattern.exec(html)) && results.length < MAX_SEARCH_RESULTS) {
    const [, rawHref, rawTitle] = match;
    const url = decodeDuckDuckGoUrl(rawHref);

    if (!url) {
      continue;
    }

    const title = collapseWhitespace(stripHtml(rawTitle));

    if (!title) {
      continue;
    }

    const snippet = extractSnippetNear(html, match.index);
    results.push({ url, title, snippet });
  }

  return dedupeResults(results);
}

function extractSnippetNear(html, index) {
  const nearby = html.slice(index, index + 1200);
  const snippetMatch = nearby.match(/result__snippet[^>]*>([\s\S]*?)<\/a>|result__snippet[^>]*>([\s\S]*?)<\/div>/i);
  const rawSnippet = snippetMatch?.[1] ?? snippetMatch?.[2] ?? '';
  return collapseWhitespace(stripHtml(rawSnippet)).slice(0, 280);
}

function decodeDuckDuckGoUrl(rawHref) {
  try {
    const absolute = rawHref.startsWith('//') ? `https:${rawHref}` : rawHref;
    const parsed = new URL(absolute, 'https://duckduckgo.com');
    const uddg = parsed.searchParams.get('uddg');
    const target = uddg ? decodeURIComponent(uddg) : absolute;
    const url = new URL(target);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    if (isBlockedHostname(url.hostname)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function dedupeResults(results) {
  const seen = new Set();
  const output = [];

  for (const result of results) {
    if (seen.has(result.url)) {
      continue;
    }

    seen.add(result.url);
    output.push(result);
  }

  return output;
}

async function fetchPageContent(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'PRYMAL/1.0 (+https://prymal.io)',
        Accept: 'text/html,application/xhtml+xml,text/plain,application/json,text/markdown;q=0.9,*/*;q=0.5',
      },
    });

    if (!response.ok) {
      throw new Error(`Received ${response.status} from ${safeHostname(url)}.`);
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (!isSupportedContentType(contentType)) {
      throw new Error(`Unsupported content type: ${contentType || 'unknown'}.`);
    }

    const raw = await response.text();
    const normalized = normalizeContent(raw, contentType).slice(0, MAX_CONTENT_CHARS);
    const title = extractTitle(raw, response.url || url);

    if (!normalized.trim()) {
      throw new Error('The page did not return readable text content.');
    }

    return {
      url: response.url || url,
      title,
      html: raw,
      content: normalized,
      summary: normalized.slice(0, 1200),
      fetchedVia: 'fetch',
      screenshotUrl: null,
      error: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPageInBrowser(url, { screenshot }) {
  let playwright;

  try {
    playwright = await import('playwright');
  } catch {
    return null;
  }

  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1080 },
    });

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: FETCH_TIMEOUT_MS,
    });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const title = (await page.title()) || safeHostname(url);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const normalized = collapseWhitespace(bodyText).slice(0, MAX_CONTENT_CHARS);

    if (!normalized) {
      return null;
    }

    let screenshotUrl = null;

    if (screenshot) {
      screenshotUrl = await saveScreenshot(page, url);
    }

    const html = await page.content().catch(() => '');

    return {
      url: page.url(),
      title,
      html,
      content: normalized,
      summary: normalized.slice(0, 1200),
      fetchedVia: screenshot ? 'browser+screenshot' : 'browser',
      screenshotUrl,
      error: null,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function saveScreenshot(page, url) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const slug = createHash('sha1').update(url).digest('hex').slice(0, 16);
  const fileName = `${slug}.png`;
  const filePath = path.join(SCREENSHOT_DIR, fileName);
  const buffer = await page.screenshot({ fullPage: true, type: 'png' });
  await writeFile(filePath, buffer);
  return `/web-assets/${fileName}`;
}

function extractInternalLinks(html, baseUrl) {
  const results = [];
  const seen = new Set();
  const pattern = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = pattern.exec(html)) && results.length < MAX_INTERNAL_LINKS) {
    const [, href, label] = match;

    try {
      const url = new URL(href, baseUrl);
      const base = new URL(baseUrl);

      if (url.origin !== base.origin) {
        continue;
      }

      if (!['http:', 'https:'].includes(url.protocol)) {
        continue;
      }

      if (seen.has(url.toString())) {
        continue;
      }

      const text = collapseWhitespace(stripHtml(label)).slice(0, 120);

      if (!text || /login|sign in|privacy|cookie|terms/i.test(text)) {
        continue;
      }

      seen.add(url.toString());
      results.push({ url: url.toString(), text });
    } catch {}
  }

  return results;
}

function shouldEscalateToBrowser(page, wantsBrowserAutomation) {
  if (wantsBrowserAutomation) {
    return true;
  }

  const lower = page.content.toLowerCase();
  return (
    page.content.length < 700 ||
    /enable javascript|javascript required|app shell|loading\.\.\.|please wait/i.test(lower)
  );
}

function normalizeContent(raw, contentType) {
  if (contentType.includes('application/json')) {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw.trim();
    }
  }

  if (
    contentType.includes('text/plain') ||
    contentType.includes('text/markdown') ||
    contentType.includes('application/xml') ||
    contentType.includes('text/xml')
  ) {
    return collapseWhitespace(raw);
  }

  return collapseWhitespace(stripHtml(raw));
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(p|div|section|article|main|header|footer|li|h1|h2|h3|h4|h5|h6|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function collapseWhitespace(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function extractTitle(raw, fallbackUrl) {
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  if (titleMatch?.[1]) {
    return collapseWhitespace(stripHtml(titleMatch[1])).slice(0, 140);
  }

  return safeHostname(fallbackUrl);
}

function isSupportedContentType(contentType) {
  if (!contentType) {
    return true;
  }

  return (
    contentType.includes('text/html') ||
    contentType.includes('application/xhtml+xml') ||
    contentType.includes('text/plain') ||
    contentType.includes('application/json') ||
    contentType.includes('text/markdown') ||
    contentType.includes('application/xml') ||
    contentType.includes('text/xml')
  );
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'web-source';
  }
}

function isBlockedHostname(hostname) {
  const normalized = hostname.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) {
    return true;
  }

  if (normalized === '0.0.0.0') {
    return true;
  }

  if (isIpv4Address(normalized)) {
    return isPrivateIpv4(normalized);
  }

  if (normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  return false;
}

function isIpv4Address(value) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
}

function isPrivateIpv4(ip) {
  const [a, b] = ip.split('.').map(Number);

  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}
