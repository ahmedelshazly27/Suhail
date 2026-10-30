// Renders reference/dashboard-mockup/*.dc.html to PNG so builds can be compared against the approved mockups.
// The mockups use a small template dialect (x-dc, sc-for, sc-if, dc-import, {{ }}); this evaluates it in the page.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("reference/dashboard-mockup");
const out = path.resolve(process.argv[2] || "test-results/mockups");
const only = process.argv[3];
fs.mkdirSync(out, { recursive: true });

function parts(file) {
  const html = fs.readFileSync(path.join(dir, file), "utf8");
  const body = html.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1];
  const helmet = (body.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ""])[1];
  const tpl = body.replace(/<helmet>[\s\S]*?<\/helmet>/, "");
  const sm = html.match(/<script type="text\/x-dc"[^>]*data-props='([^']*)'[^>]*>([\s\S]*?)<\/script>/);
  return { helmet, tpl, props: sm ? JSON.parse(sm[1]) : {}, logic: sm ? sm[2] : "class Component extends DCLogic{renderVals(){return {}}}" };
}

const runtime = `
class DCLogic { constructor(props){ this.props = props; this.state = {}; } setState(){} }
function ev(expr, scope){ try { return Function(...Object.keys(scope), "return (" + expr + ")")(...Object.values(scope)); } catch(e){ return undefined; } }
function interp(s, scope){ return s.replace(/\\{\\{([\\s\\S]*?)\\}\\}/g, (_, e) => { const v = ev(e.trim(), scope); return v == null ? "" : String(v); }); }
function renderNode(node, scope){
  if (node.nodeType === 3){ node.textContent = interp(node.textContent, scope); return; }
  if (node.nodeType !== 1) return;
  const tag = node.tagName.toLowerCase();
  if (tag === "sc-for"){
    const m = node.getAttribute("list").match(/\\{\\{([\\s\\S]*?)\\}\\}/); const list = ev(m[1].trim(), scope) || []; const as = node.getAttribute("as") || "item";
    const frag = document.createDocumentFragment();
    list.forEach((it, i) => { const c = document.createElement("div"); c.innerHTML = node.innerHTML; const sc = { ...scope, [as]: it, index: i };
      [...c.childNodes].forEach(n => { renderNode(n, sc); frag.appendChild(n); }); });
    node.replaceWith(frag); return;
  }
  if (tag === "sc-if"){
    const m = node.getAttribute("value").match(/\\{\\{([\\s\\S]*?)\\}\\}/); const v = ev(m[1].trim(), scope);
    if (!v){ node.remove(); return; } const frag = document.createDocumentFragment(); [...node.childNodes].forEach(n => { renderNode(n, scope); frag.appendChild(n); }); node.replaceWith(frag); return;
  }
  if (tag === "dc-import"){
    const name = node.getAttribute("name"); const C = window.__DC[name]; if (!C) return;
    const props = {}; [...node.attributes].forEach(a => props[a.name] = interp(a.value, scope));
    const host = document.createElement("div"); host.style.cssText = node.getAttribute("style") || ""; host.style.display = host.style.display || "contents";
    host.innerHTML = C.tpl; const vals = new (C.cls)(props).renderVals(); [...host.childNodes].forEach(n => renderNode(n, { ...vals, props }));
    node.replaceWith(host); return;
  }
  [...node.attributes].forEach(a => { if (a.value.includes("{{")) node.setAttribute(a.name, interp(a.value, scope)); });
  [...node.childNodes].forEach(n => renderNode(n, scope));
}`;

const files = fs.readdirSync(dir).filter(f => f.endsWith(".dc.html") && (!only || f.startsWith(only)));
const browser = await chromium.launch();
for (const f of files) {
  const p = parts(f);
  const deps = [...p.tpl.matchAll(/<dc-import name="([^"]+)"/g)].map(m => m[1]);
  const depDefs = deps.map(d => { const q = parts(d + ".dc.html"); return `window.__DC[${JSON.stringify(d)}] = { tpl: ${JSON.stringify(q.tpl)}, cls: (function(){ ${q.logic}; return Component; })() };`; }).join("\n");
  const defaults = Object.fromEntries(Object.entries(p.props).filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, v.default]));
  const preview = p.props.$preview || { width: 1440, height: 980 };
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">${p.helmet}</head><body><div id="root">${p.tpl}</div>
<script>${runtime}
window.__DC = {}; ${depDefs}
const Component = (function(){ ${p.logic}; return Component; })();
const vals = new Component(${JSON.stringify(defaults)}).renderVals();
const root = document.getElementById("root"); [...root.childNodes].forEach(n => renderNode(n, { ...vals, props: ${JSON.stringify(defaults)} }));
</script></body></html>`;
  const page = await browser.newPage({ viewport: { width: preview.width || 1440, height: preview.height || 980 } });
  await page.setContent(html, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, f.replace(".dc.html", ".png")), fullPage: true });
  await page.close();
  console.log("rendered", f, JSON.stringify(preview));
}
await browser.close();
