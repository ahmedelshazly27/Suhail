// Pulls every string and form definition out of reference/suhail.html so the site copy is word for word.
// Writes content/*.json. The only change made to the copy: em dashes become en dashes (house rule, see PROGRESS.md).
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("reference/suhail.html", "utf8");
const js = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
const lines = js.split("\n");
const take = (from, to) => { const a = lines.findIndex((l) => l.startsWith(from)); const b = lines.findIndex((l, i) => i > a && l.startsWith(to)); return lines.slice(a, b).join("\n"); };

const code = [
  take("const T = {", "/* ---------------------------------------------------------------- ASCII scenes"),
  take("/* ---------------------------------------------------------------- strings for the rebuilt pages", "const SOON_PAGES"),
  take("const AGENDA", "const STAR"),
  "const WHO = " + lines.find((l) => l.startsWith("const WHO")).slice(12),
  "const STAGES = " + lines.find((l) => l.startsWith("const STAGES")).slice(15),
  `globalThis.__out = { T, COUNTRIES, FORMS, ROLES_OPEN, ROLE_FORMS, BASICS: BASICS(), CLOSE: CLOSE(), AGENDA, EVENTS_DRAFT, WHO, STAGES };`,
].join("\n");
const ctx = { localStorage: { getItem: () => null }, document: {}, console };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const o = ctx.__out;

const fix = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === "function" ? (k === "opts" ? "@countries" : `@fn:${x.toString()}`) : typeof x === "string" ? x.replaceAll("—", "–") : x)));
fs.mkdirSync("content", { recursive: true });
const w = (f, v) => fs.writeFileSync("content/" + f, JSON.stringify(fix(v), null, 1) + "\n");
w("strings.json", o.T);
w("countries.json", o.COUNTRIES);
// The hack form's event options come from the published hackathons at runtime.
const forms = fix(o.FORMS);
for (const k of Object.keys(forms)) if (k.startsWith("careers_")) delete forms[k];
forms.hack.fields.forEach((f) => { if (f.id === "event") f.opts = "@hackathons"; });
fs.writeFileSync("content/forms.json", JSON.stringify(forms, null, 1) + "\n");
w("careers.json", { roles: o.ROLES_OPEN, roleForms: o.ROLE_FORMS, basics: o.BASICS, close: o.CLOSE });
w("events.json", { agenda: o.AGENDA, drafts: o.EVENTS_DRAFT, who: o.WHO, stages: o.STAGES });
console.log("strings:", Object.keys(o.T.ar).length, "ar keys,", Object.keys(o.T.en).length, "en keys; forms:", Object.keys(forms).join(","));
