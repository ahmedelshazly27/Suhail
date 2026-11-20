import type { ReactNode } from "react";

// Light Markdown for text written by agents (drafts, timeline notes): headings, bullets, bold, [links](url) and
// bare links. Everything stays text; no HTML from the source is ever injected.

const TOKEN = /(\[[^\]]{1,200}\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+|\*\*[^*]{1,300}\*\*)/g;
const short = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 48) + (u.length > 60 ? "…" : "");

function inline(s: string, key: string): ReactNode[] {
  return s.split(TOKEN).map((p, i) => {
    const k = `${key}-${i}`;
    const md = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(p);
    if (md) return <a key={k} href={md[2]} target="_blank" rel="noreferrer">{md[1]}</a>;
    if (/^https?:\/\//.test(p)) return <a key={k} href={p} target="_blank" rel="noreferrer">{short(p)}</a>;
    if (/^\*\*.+\*\*$/.test(p)) return <b key={k}>{p.slice(2, -2)}</b>;
    return p;
  });
}

export function Md({ text, className = "md" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className={className} dir="auto">
      {blocks.map((b, i) => {
        const h = /^#{1,4}\s+(.*)$/.exec(b.trim());
        if (h && !b.trim().includes("\n")) return <h3 key={i}>{inline(h[1], `h${i}`)}</h3>;
        const lines = b.split("\n");
        const head = /^#{1,4}\s+/.test(lines[0]) ? lines.shift()! : null;
        const list = lines.length > 0 && lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l));
        return (
          <div key={i} className="md-b">
            {head ? <h3>{inline(head.replace(/^#{1,4}\s+/, ""), `hh${i}`)}</h3> : null}
            {list ? <ul>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ""), `${i}-${j}`)}</li>)}</ul>
              : lines.length ? <p>{lines.map((l, j) => <span key={j}>{j ? <br /> : null}{inline(l, `${i}-${j}`)}</span>)}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
