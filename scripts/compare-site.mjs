// Screenshots each public page from reference/suhail.html and from the running app at the same size and language,
// and writes them side by side (prototype on the left) to test-results/compare/.
// Usage: node scripts/compare-site.mjs [baseUrl] [pages,comma] [widths,comma] [langs,comma]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");

const base = process.argv[2] || "http://localhost:3000";
const pages = (process.argv[3] || "home,manifesto,careers,season,hackathons,house,jobs,partners,podcast").split(",");
const widths = (process.argv[4] || "1440,390").split(",").map(Number);
const langs = (process.argv[5] || "ar,en").split(",");
const out = path.resolve("test-results/compare");
fs.mkdirSync(out, { recursive: true });
const exe = fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
const browser = await chromium.launch(exe);
const proto = "file://" + path.resolve("reference/suhail.html");

for (const lang of langs) for (const w of widths) for (const p of pages) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
  await ctx.addInitScript((l) => { try { localStorage.setItem("suhail-lang", l); } catch {} }, lang);
  const a = await ctx.newPage();
  await a.goto(proto + (p === "home" ? "" : "#" + p));
  await a.waitForTimeout(1200);
  const pa = path.join(out, `${p}-${lang}-${w}-proto.png`);
  await a.screenshot({ path: pa, fullPage: true });
  const b = await ctx.newPage();
  await b.goto(base + (lang === "en" ? "/en" : "") + (p === "home" ? "" : "/" + p), { waitUntil: "networkidle" });
  await b.waitForTimeout(1200);
  const pb = path.join(out, `${p}-${lang}-${w}-app.png`);
  await b.screenshot({ path: pb, fullPage: true });
  // side by side
  const c = await ctx.newPage();
  const [da, db] = [fs.readFileSync(pa).toString("base64"), fs.readFileSync(pb).toString("base64")];
  await c.setViewportSize({ width: w * 2 + 20, height: 900 });
  await c.setContent(`<body style="margin:0;display:flex;gap:20px;align-items:flex-start;background:#888"><img src="data:image/png;base64,${da}"><img src="data:image/png;base64,${db}"></body>`);
  await c.screenshot({ path: path.join(out, `${p}-${lang}-${w}.png`), fullPage: true });
  await ctx.close();
  console.log("compared", p, lang, w);
}
await browser.close();
