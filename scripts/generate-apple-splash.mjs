import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd());
const iconPath = path.join(ROOT, "public", "icon-512.png");
const outDir = path.join(ROOT, "public", "apple-splash");

const LIGHT_BG = "#ffffff";
const DARK_BG = "#111111";

const targets = [
  // iPhone
  { w: 1290, h: 2796, key: "iphone-14-pro-max" },
  { w: 1284, h: 2778, key: "iphone-13-pro-max" },
  { w: 1242, h: 2688, key: "iphone-xs-max" },
  { w: 1179, h: 2556, key: "iphone-14-pro" },
  { w: 1170, h: 2532, key: "iphone-13" },
  { w: 1125, h: 2436, key: "iphone-x" },
  { w: 1242, h: 2208, key: "iphone-8-plus" },
  { w: 828, h: 1792, key: "iphone-xr" },
  { w: 750, h: 1334, key: "iphone-8" },

  // iPad
  { w: 2048, h: 2732, key: "ipad-12-9" },
  { w: 1668, h: 2388, key: "ipad-11" },
  { w: 1668, h: 2224, key: "ipad-10-5" },
  { w: 1620, h: 2160, key: "ipad-10-2" },
  { w: 1536, h: 2048, key: "ipad-9-7" },
  { w: 1488, h: 2266, key: "ipad-mini-8-3" },
];

await fs.mkdir(outDir, { recursive: true });

const iconBuffer = await fs.readFile(iconPath);

async function writeSplash({ w, h, bg, theme }) {
  const iconSize = Math.round(Math.min(w, h) * 0.2);
  const resizedIcon = await sharp(iconBuffer)
    .resize(iconSize, iconSize, { fit: "contain" })
    .png()
    .toBuffer();

  const outPath = path.join(outDir, `splash-${w}x${h}-${theme}.png`);
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: bg,
    },
  })
    .composite([{ input: resizedIcon, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

for (const t of targets) {
  await writeSplash({ ...t, bg: LIGHT_BG, theme: "light" });
  await writeSplash({ ...t, bg: DARK_BG, theme: "dark" });
}

// Apple touch icon (used by iOS when adding to Home Screen)
await sharp(iconBuffer)
  .resize(180, 180, { fit: "cover" })
  .png({ compressionLevel: 9 })
  .toFile(path.join(ROOT, "public", "apple-touch-icon.png"));

console.log(`Generated splash images in ${path.relative(ROOT, outDir)}`);

