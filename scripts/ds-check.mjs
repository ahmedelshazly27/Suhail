// Design-system guard, run in CI. Fails on:
//   1. raw hex colours, font-family names or px border-radius outside design-system/
//   2. physical direction properties (left/right) instead of logical ones
//   3. em dashes in copy
// A line can opt out with a trailing `ds-allow: <reason>` comment. Use it only for non-visual values
// (for example the offscreen density buffer the ASCII scenes draw into).
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["app", "components", "lib", "emails", "styles", "content", "supabase/seed"];
const EXT = /\.(tsx?|jsx?|mjs|css|json|sql|md)$/;
const SKIP = [/^emails\/theme\.ts$/, /node_modules/, /\.next/];

const rules = [
  { name: "raw hex colour", re: /#[0-9a-fA-F]{3,8}\b(?![\w-])/, only: /\.(tsx?|jsx?|css)$/ },
  { name: "font name", re: /(["'])(Newsreader|IBM Plex[\w ]*|Amiri|Georgia|Arial|Helvetica|Inter|Roboto)\1|font-family:\s*(?!var\()[A-Za-z"']/, only: /\.(tsx?|jsx?|css)$/, skip: /next\/font|lib\/fonts\.ts$/ },
  { name: "px border-radius", re: /border-radius:\s*[\d.]+px|borderRadius:\s*["']?[\d.]+(px)?["']?[,}\s]|rounded-\[[\d.]+px\]/, only: /\.(tsx?|jsx?|css)$/ },
  { name: "physical direction", re: /\b(margin|padding|border)-(left|right)\b|(?<![\w-])(left|right)\s*:|text-align:\s*(left|right)|float:\s*(left|right)|\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeft|borderRight)\b|(?<![\w-])(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|text-left|text-right)-[\w[]|\b(text-left|text-right)\b/, only: /\.(tsx?|jsx?|css)$/ },
  { name: "em dash", re: /—/, only: /./ },
];

const files = [];
const walk = (d) => {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (SKIP.some((r) => r.test(p))) continue;
    if (e.isDirectory()) walk(p);
    else if (EXT.test(e.name)) files.push(p);
  }
};
ROOTS.forEach(walk);
// copy files at the root that ship to people
["README.md", "docs"].forEach((p) => (fs.existsSync(p) && fs.statSync(p).isDirectory() ? walk(p) : fs.existsSync(p) && files.push(p)));

let bad = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/ds-allow:/.test(line)) return;
    for (const r of rules) {
      if (!r.only.test(f) || (r.skip && r.skip.test(f))) continue;
      if (r.name !== "em dash" && /^\s*(\/\/|\*|\/\*)/.test(line)) continue; // comments may talk about rules
      if (r.re.test(line)) {
        bad++;
        console.log(`${f}:${i + 1}  ${r.name}: ${line.trim().slice(0, 140)}`);
      }
    }
  });
}
if (bad) {
  console.log(`\nds-check: ${bad} problem(s). Use design-system tokens and logical properties.`);
  process.exit(1);
}
console.log(`ds-check: ${files.length} files clean`);
