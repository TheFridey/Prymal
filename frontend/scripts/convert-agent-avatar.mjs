import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const [, , inputArg, agentIdArg, qualityArg] = process.argv;

if (!inputArg || !agentIdArg) {
  console.error('Usage: npm run avatar:prepare -- "<input-image>" <agent-id> [quality]');
  process.exit(1);
}

const quality = Number.parseInt(qualityArg ?? '86', 10);
const safeQuality = Number.isFinite(quality) ? Math.max(40, Math.min(quality, 100)) : 86;

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.resolve(process.cwd(), inputArg);
const outputDir = path.join(rootDir, 'src', 'assets', 'agents');
const outputPath = path.join(outputDir, `${agentIdArg.toLowerCase()}.webp`);

await fs.mkdir(outputDir, { recursive: true });

const image = sharp(inputPath);
const metadata = await image.metadata();
const maxWidth = 1024;
const resized = metadata.width && metadata.width > maxWidth ? image.resize({ width: maxWidth }) : image;

await resized
  .webp({
    quality: safeQuality,
    effort: 6,
  })
  .toFile(outputPath);

console.log(`Converted ${path.basename(inputPath)} -> ${path.relative(rootDir, outputPath)}`);
