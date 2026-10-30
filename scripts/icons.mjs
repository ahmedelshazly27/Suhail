// Renders the PWA icons and Open Graph images from the star mark with the brand tokens. Run: node scripts/icons.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const t = JSON.parse(fs.readFileSync("design-system/tokens.json", "utf8")).light;
const star = (size, color) => `<svg width="${size}" height="${size}" viewBox="0 0 20 20"><path fill="${color}" d="M10 0 L11.6 8.4 L20 10 L11.6 11.6 L10 20 L8.4 11.6 L0 10 L8.4 8.4 Z"/></svg>`;
const fonts = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=Newsreader:opsz,wght@6..72,300;6..72,400&family=IBM+Plex+Mono&display=swap">`;
const exe = fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
const b = await chromium.launch(exe);
async function shot(file, w, h, html) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<!doctype html><html><head>${fonts}<style>body{margin:0}</style></head><body>${html}</body></html>`, { waitUntil: "networkidle" });
  await p.screenshot({ path: file, omitBackground: false });
  await p.close();
}
fs.mkdirSync("public/icons", { recursive: true });
for (const [n, s, pad] of [["icon-192.png", 192, 0.28], ["icon-512.png", 512, 0.28], ["maskable-512.png", 512, 0.36]])
  await shot(`public/icons/${n}`, s, s, `<div style="width:${s}px;height:${s}px;background:${t.fg};display:grid;place-items:center">${star(Math.round(s * (1 - 2 * pad)), t.bg)}</div>`);
await shot("app/apple-icon.png", 180, 180, `<div style="width:180px;height:180px;background:${t.fg};display:grid;place-items:center">${star(110, t.bg)}</div>`);
await shot("app/icon.png", 64, 64, `<div style="width:64px;height:64px;background:${t.bg};display:grid;place-items:center">${star(44, t.accent)}</div>`);
for (const [lang, title, sub] of [["en", "Suhail", "One ecosystem for the people building the future of Arab tech."], ["ar", "سهيل", "منظومة واحدة للناس اللي يبنون مستقبل التقنية العربية."]])
  await shot(`public/og-${lang}.png`, 1200, 630, `<div dir="${lang === "ar" ? "rtl" : "ltr"}" style="width:1200px;height:630px;box-sizing:border-box;background:${t.bg};color:${t.fg};padding:80px;display:flex;flex-direction:column;justify-content:space-between;font-family:${lang === "ar" ? "Amiri" : "Newsreader"},serif">
    <div style="display:flex;align-items:center;gap:18px;font-size:44px;${lang === "ar" ? "font-weight:700" : ""}">${star(40, t.accent)}<span>${title}</span></div>
    <div style="font-size:${lang === "ar" ? 62 : 64}px;line-height:1.25;font-weight:300;max-width:960px">${sub}</div>
    <div style="height:60px;opacity:.45;background-image:radial-gradient(circle, ${t.accent} 0 2px, transparent 2.5px);background-size:12px 12px;-webkit-mask-image:linear-gradient(90deg,transparent 30%,#000)"></div></div>`);
await b.close();
console.log("icons and og images written");
