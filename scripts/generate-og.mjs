// Generates public/og-image.png (1200x630) for social embeds.
// Run: `node scripts/generate-og.mjs`. Output is committed; this is not part of the build pipeline.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public');
const outFile = resolve(outDir, 'og-image.png');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#050505"/>

  <text x="54" y="76" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="-1" fill="#efeee8">SOUND/IN</text>

  <text x="54" y="188" font-family="monospace" font-size="11" letter-spacing="1" fill="#efeee8" opacity=".62">INDEPENDENT SOFTWARE COMPANY / SCOTLAND</text>
  <text x="54" y="280" font-family="Arial, Helvetica, sans-serif" font-size="66" font-weight="600" letter-spacing="-2.5" fill="#efeee8">Infrastructure for</text>
  <text x="54" y="348" font-family="Arial, Helvetica, sans-serif" font-size="66" font-weight="600" letter-spacing="-2.5" fill="#efeee8">Scotland after dark.</text>
  <line x1="54" y1="434" x2="720" y2="434" stroke="#efeee8" stroke-opacity=".3"/>
  <text x="54" y="482" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#efeee8" opacity=".72">Calm, accountable systems for Scotland's night-time economy.</text>
  <text x="54" y="574" font-family="monospace" font-size="10" letter-spacing="1" fill="#efeee8" opacity=".55">SOUNDIN.SCOT / SCOTLAND / SC850719</text>

  <g transform="translate(770 0)">
    <rect width="430" height="630" fill="#0a0a0a"/>
    <g stroke="#fff" stroke-opacity=".12">
      <path d="M0 70h430M0 140h430M0 210h430M0 280h430M0 350h430M0 420h430M0 490h430M0 560h430"/>
      <path d="M72 0v630M144 0v630M216 0v630M288 0v630M360 0v630"/>
    </g>
    <text x="28" y="48" font-family="monospace" font-size="10" fill="#efeee8">H/01</text>
    <text x="402" y="48" text-anchor="end" font-family="monospace" font-size="9" fill="#efeee8" opacity=".6">ILLUSTRATIVE RECORD</text>
    <text x="28" y="137" font-family="monospace" font-size="9" fill="#efeee8" opacity=".55">SAT / 18 JUL</text>
    <text x="24" y="264" font-family="Arial, Helvetica, sans-serif" font-size="116" font-weight="500" letter-spacing="-4" fill="#efeee8">23:48</text>
    <text x="28" y="293" font-family="monospace" font-size="8" fill="#efeee8" opacity=".55">DOORS 22:00 / CLOSE 03:00</text>
    <rect x="28" y="368" width="374" height="170" fill="none" stroke="#efeee8" stroke-opacity=".4"/>
    <line x1="244" y1="368" x2="244" y2="538" stroke="#efeee8" stroke-opacity=".4"/>
    <text x="45" y="398" font-family="monospace" font-size="8" fill="#efeee8" opacity=".6">01 / ATTENDANCE</text>
    <text x="45" y="472" font-family="Arial, Helvetica, sans-serif" font-size="62" fill="#efeee8">684</text>
    <line x1="45" y1="500" x2="218" y2="500" stroke="#efeee8" stroke-opacity=".22" stroke-width="4"/>
    <line x1="45" y1="500" x2="178" y2="500" stroke="#efeee8" stroke-width="4"/>
    <text x="264" y="398" font-family="monospace" font-size="8" fill="#efeee8" opacity=".6">02 / FLOOR</text>
    <circle cx="323" cy="462" r="39" fill="none" stroke="#efeee8" stroke-opacity=".5"/>
    <circle cx="323" cy="462" r="28" fill="none" stroke="#efeee8" stroke-opacity=".3" stroke-dasharray="3 4"/>
    <text x="323" y="466" text-anchor="middle" font-family="monospace" font-size="8" fill="#efeee8">STEADY</text>
    <circle cx="394" cy="48" r="3" fill="#efeee8"/>
    <text x="28" y="594" font-family="monospace" font-size="8" fill="#efeee8" opacity=".5">SAMPLE DATA ONLY</text>
  </g>
</svg>`;

await mkdir(outDir, { recursive: true });
await sharp(Buffer.from(svg)).png({ quality: 92 }).toFile(outFile);
console.log(`Wrote ${outFile}`);
