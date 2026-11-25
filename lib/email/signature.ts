import { theme } from "@/emails/theme";

// The email signature added to every message the dashboard writes from someone's Outlook: new emails, drafts the
// agents prepare, and replies. Outlook's own signature isn't reachable through Microsoft Graph, so it is added here.
// Plain text and simple HTML (one table, inline styles) so it looks the same in Outlook, Gmail and Apple Mail.

export type Signer = { name: string; job_title: string; email: string; team_role?: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const titleOf = (p: Signer) => p.job_title?.trim() || (p.team_role === "owner" ? "Founder" : "");

export function signatureText(p: Signer) {
  const title = titleOf(p);
  return ["--", p.name, `${title ? `${title}, ` : ""}Suhail · سهيل`, `suhail.build · ${p.email}`].join("\n");
}

export function signatureHtml(p: Signer) {
  const title = titleOf(p);
  const s = `font-family:${theme.body}; font-size:13px; line-height:1.5; color:${theme.muted}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px; border-collapse:collapse">
<tr><td style="padding:0 0 2px; font-family:${theme.body}; font-size:14px; font-weight:600; color:${theme.fg}">${esc(p.name)}</td></tr>
<tr><td style="${s}">${title ? `${esc(title)}, ` : ""}<span style="color:${theme.accent}">✦</span> Suhail · <span dir="rtl" lang="ar" style="font-family:${theme.displayAr}">سهيل</span></td></tr>
<tr><td style="${s}"><a href="https://suhail.build" style="color:${theme.fg}; text-decoration:none">suhail.build</a> · <a href="mailto:${esc(p.email)}" style="color:${theme.muted}; text-decoration:none">${esc(p.email)}</a></td></tr>
</table>`;
}

/** A plain-text message as HTML paragraphs (Arabic paragraphs right to left), with the signature under it. */
export function emailHtml(text: string, p: Signer) {
  const paras = text.replace(/\r/g, "").trim().split(/\n{2,}/).map((b) => {
    const rtl = /[؀-ۿ]/.test(b) && !/^[\s\x00-\x7F]*$/.test(b.slice(0, 20)) ;
    return `<p style="margin:0 0 14px; font-family:${rtl ? theme.displayAr : theme.body}; font-size:15px; line-height:1.6; color:${theme.fg}"${rtl ? ' dir="rtl"' : ""}>${esc(b).replace(/\n/g, "<br>")}</p>`;
  });
  return `<div>${paras.join("\n")}${signatureHtml(p)}</div>`;
}
