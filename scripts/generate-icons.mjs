import sharp from "sharp";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, "..", "public");

const svgBuffer = readFileSync(join(publicDir, "icon.svg"));

// Generate 192x192
await sharp(svgBuffer)
  .resize(192, 192)
  .png()
  .toFile(join(publicDir, "icon-192.png"));

console.log("✓ Generated icon-192.png");

// Generate 512x512
await sharp(svgBuffer)
  .resize(512, 512)
  .png()
  .toFile(join(publicDir, "icon-512.png"));

console.log("✓ Generated icon-512.png");

console.log("All icons generated successfully!");
