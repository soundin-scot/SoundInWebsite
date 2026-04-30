// Generates public/og-image.png (1200x630) for social embeds.
// Run: `node scripts/generate-og.mjs`. Output is committed; this is not part of the build pipeline.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public');
const outFile = resolve(outDir, 'og-image.png');

const W = 1200;
const H = 630;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1d2825"/>
      <stop offset="100%" stop-color="#24302c"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.7">
      <stop offset="0%" stop-color="rgba(255,127,107,0.10)"/>
      <stop offset="100%" stop-color="rgba(255,127,107,0)"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Topographic contour lines -->
  <g fill="none" stroke="rgba(231,223,217,0.07)" stroke-width="1">
    <path d="M-40 480 C200 440, 400 500, 620 440 C820 380, 1000 460, 1200 400 C1340 360, 1460 420, 1540 390"/>
    <path d="M-40 360 C180 320, 380 380, 580 320 C780 270, 960 340, 1160 290 C1300 250, 1420 310, 1540 280"/>
    <path d="M-40 240 C200 210, 420 260, 640 210 C820 170, 1000 230, 1200 190 C1340 160, 1460 210, 1540 190"/>
  </g>
  <path d="M-40 510 C200 470, 420 540, 640 470 C840 410, 1020 490, 1220 430 C1360 380, 1470 450, 1540 420"
        fill="none" stroke="rgba(255,127,107,0.18)" stroke-width="1.6"/>
  <circle cx="640" cy="470" r="3.5" fill="rgba(255,127,107,0.55)"/>

  <!-- Wordmark -->
  <g transform="translate(80, 300)">
    <text x="0" y="0"
          font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
          font-weight="900"
          font-size="180"
          fill="#e7dfd9"
          letter-spacing="-4">Sound</text>
    <text x="555" y="0"
          font-family="Georgia, 'Times New Roman', serif"
          font-style="italic"
          font-weight="300"
          font-size="180"
          fill="#ff7f6b">In</text>
  </g>

  <!-- Tagline -->
  <text x="80" y="440"
        font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-weight="400"
        font-size="32"
        fill="rgba(231,223,217,0.75)">Software, events, and open-source tools</text>
  <text x="80" y="484"
        font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-weight="400"
        font-size="32"
        fill="rgba(231,223,217,0.75)">out of the Scottish Highlands.</text>

  <!-- Footer line -->
  <line x1="80" y1="555" x2="1120" y2="555" stroke="rgba(231,223,217,0.12)" stroke-width="1"/>
  <text x="80" y="595"
        font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-weight="700"
        font-size="18"
        letter-spacing="3"
        fill="rgba(231,223,217,0.55)">SOUNDIN.SCOT</text>
  <text x="1120" y="595" text-anchor="end"
        font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-weight="400"
        font-size="18"
        letter-spacing="2"
        fill="rgba(231,223,217,0.4)">57.48&#176;N · SC850719</text>
</svg>`;

await mkdir(outDir, { recursive: true });
await sharp(Buffer.from(svg)).png({ quality: 90 }).toFile(outFile);

console.log(`Wrote ${outFile}`);
