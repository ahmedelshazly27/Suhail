import "server-only";
import { generateHTML } from "@tiptap/html";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import sanitize from "sanitize-html";
import { theme } from "@/emails/theme";

/** Tiptap JSON to email-safe HTML: inline styles from the email theme, nothing else allowed through. */
export function docToEmailHtml(doc: unknown, lang: "ar" | "en"): string {
  if (!doc || typeof doc !== "object") return "";
  const raw = generateHTML(doc as never, [StarterKit.configure({ link: false }), Link]);
  const clean = sanitize(raw, { allowedTags: ["p", "h2", "h3", "strong", "em", "a", "ul", "ol", "li", "blockquote", "br", "hr"], allowedAttributes: { a: ["href"] }, allowedSchemes: ["https", "mailto"] });
  const disp = lang === "ar" ? "'Amiri', " + theme.display : theme.display;
  return clean
    .replace(/<h2>/g, `<h2 style="font-family:${disp};font-weight:400;font-size:26px;line-height:1.35;margin:0 0 14px">`)
    .replace(/<h3>/g, `<h3 style="font-size:16px;font-weight:600;margin:18px 0 8px">`)
    .replace(/<p>/g, `<p style="margin:0 0 14px">`)
    .replace(/<blockquote>/g, `<blockquote style="margin:0 0 14px;border-${lang === "ar" ? "right" : "left"}:2px solid ${theme.fg};padding-${lang === "ar" ? "right" : "left"}:14px;color:${theme.muted};font-family:${disp}">`) // ds-allow: email clients need physical sides
    .replace(/<a href=/g, `<a style="color:${theme.fg}" href=`);
}
