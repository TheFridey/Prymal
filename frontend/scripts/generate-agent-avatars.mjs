#!/usr/bin/env node
// Usage:
//   PRYMAL_API_URL=http://localhost:3001 \
//   PRYMAL_SESSION_TOKEN=your_clerk_session_token \
//   node scripts/generate-agent-avatars.mjs
//
// Optional: only generate specific agents:
//   AGENTS=atlas,vance,wren node scripts/generate-agent-avatars.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, '../src/assets/agents');

const API_URL = process.env.PRYMAL_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
const SESSION_TOKEN = process.env.PRYMAL_SESSION_TOKEN;
const ONLY_AGENTS = process.env.AGENTS?.split(',').map((value) => value.trim()).filter(Boolean) ?? null;

if (!SESSION_TOKEN) {
  console.error('[generate-agent-avatars] PRYMAL_SESSION_TOKEN is required.');
  process.exit(1);
}

const AGENT_PROMPTS = {
  cipher: 'Dark navy background. Glowing sigma symbol at centre, surrounded by floating data nodes connected by fine electric lines in teal. Premium dark-mode analytics icon. No text. Square.',
  herald: 'Deep charcoal background. Stylised envelope or wing glyph in warm orange-red with motion blur suggesting flight. Precise and commercial. No text. Square.',
  lore: 'Deep indigo background. Open book or orbiting rings of knowledge dots in soft violet-purple. Archival, authoritative, calm. No text. Square.',
  forge: 'Dark slate background. Hammer and spark motif in golden yellow, minimal geometric style. Craftsmanship energy. No text. Square.',
  atlas: 'Deep navy background. Geometric orbital sphere with three concentric rings in electric sky blue. Minimal, spacial, structured. No text. Square.',
  echo: 'Dark background. Concentric ripple rings emanating from a central point in hot pink. Social energy, platform-native. No text. Square.',
  oracle: 'Near-black background. Targeting reticle or celestial crosshair in mint green with faint orbital arcs. SEO precision energy. No text. Square.',
  vance: 'Charcoal background. Bold upward diagonal arrow in molten orange-red with heat shimmer gradient trail. Commercial momentum. No text. Square.',
  wren: 'Deep navy background. Soft eight-pointed asterisk or snowflake glyph in mint green with gentle inner glow. Precise and approachable. No text. Square.',
  ledger: 'Dark slate background. Balanced grid of squares in cool teal with subtle double-bar accounting balance implied. Structured, authoritative. No text. Square.',
  nexus: 'Space-black background. Central hexagon in pale blue connected to six outer nodes by glowing edges. Network topology. No text. Square.',
  scout: 'Dark background. Compass rose or terrain triangulation glyph in salmon-pink. Research energy, forward-looking. No text. Square.',
  sage: 'Charcoal background. Four-pointed compass star in warm golden-sand with subtle depth and gravitas. Senior, considered, confident. No text. Square.',
  pixel: 'Black background. Colour prism refracting pink-to-violet spectrum from a single central point. Creative, vivid, precise. No text. Square.',
  sentinel: 'Deep charcoal background. Precise geometric targeting reticle or shield glyph in crimson-pink. Alert, exact, protective. No text. Square.',
};

const requestedAgentIds = ONLY_AGENTS ?? Object.keys(AGENT_PROMPTS);
const agentIds = [];
const seen = new Set();

for (const agentId of requestedAgentIds) {
  if (seen.has(agentId)) {
    continue;
  }
  seen.add(agentId);
  agentIds.push(agentId);
}

if (agentIds.length === 0) {
  console.error('[generate-agent-avatars] No agent ids were provided.');
  process.exit(1);
}

await mkdir(outputDir, { recursive: true });

const successes = [];
const failures = [];

for (const agentId of agentIds) {
  const prompt = AGENT_PROMPTS[agentId];

  if (!prompt) {
    failures.push({ agentId, error: 'Unknown agent id.' });
    console.error(`[FAIL] ${agentId}: Unknown agent id.`);
    continue;
  }

  try {
    const generationResponse = await fetch(`${API_URL}/api/agents/generate-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SESSION_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId,
        prompt,
        size: '1024x1024',
        quality: 'high',
        outputFormat: 'webp',
      }),
    });

    if (!generationResponse.ok) {
      throw new Error(await readErrorMessage(generationResponse));
    }

    const result = await generationResponse.json();
    const imageUrl = result?.image?.url;

    if (!imageUrl) {
      throw new Error('Image URL missing from generation response.');
    }

    const assetResponse = await fetch(resolveImageUrl(imageUrl), {
      headers: {
        Authorization: `Bearer ${SESSION_TOKEN}`,
      },
    });

    if (!assetResponse.ok) {
      throw new Error(`Asset fetch failed: ${await readErrorMessage(assetResponse)}`);
    }

    const buffer = Buffer.from(await assetResponse.arrayBuffer());
    await writeFile(resolve(outputDir, `${agentId}.webp`), buffer);

    successes.push(agentId);
    console.log(`[OK] ${agentId} -> src/assets/agents/${agentId}.webp`);
  } catch (error) {
    failures.push({ agentId, error: error instanceof Error ? error.message : String(error) });
    console.error(`[FAIL] ${agentId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('');
console.log(`[generate-agent-avatars] Summary: ${successes.length} succeeded, ${failures.length} failed.`);

if (failures.length > 0) {
  for (const failure of failures) {
    console.log(`  - ${failure.agentId}: ${failure.error}`);
  }
}

if (successes.length > 0) {
  console.log('');
  console.log('Add these imports to frontend/src/lib/constants.js:');
  for (const agentId of successes) {
    console.log(`import ${toImportName(agentId)} from '../assets/agents/${agentId}.webp';`);
  }
}

function resolveImageUrl(imageUrl) {
  return imageUrl.startsWith('http://') || imageUrl.startsWith('https://')
    ? imageUrl
    : `${API_URL}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
}

async function readErrorMessage(response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null);
    return body?.error ?? body?.message ?? `${response.status} ${response.statusText}`;
  }

  const text = await response.text().catch(() => '');
  return text || `${response.status} ${response.statusText}`;
}

function toImportName(agentId) {
  return `${agentId}Avatar`;
}
