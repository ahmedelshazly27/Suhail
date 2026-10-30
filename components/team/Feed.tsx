"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { addComment } from "@/app/actions/tickets";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { ago } from "@/lib/dates";
import { tt, type TKey, type TLang } from "@/lib/team-i18n";
import { Editor, RichText, type Doc } from "./Editor";
import type { FeedItem } from "@/lib/data/tickets";
import type { Person } from "@/lib/data/shell";

/** Comments and the activity log, merged in time order. Shared by tickets, applications and other records. */
export function Feed({ lang, items, people, entity, onPosted, onSend, placeholder }: { lang: TLang; items: FeedItem[]; people: Person[]; entity: { type: "ticket" | "application" | "relationship" | "project" | "expense" | "content"; id: string }; onPosted?: () => void; onSend?: (body: Doc) => Promise<void>; placeholder?: string }) {
  const name = (id: string | null) => people.find((p) => p.id === id)?.name.split(" ")[0] ?? (lang === "ar" ? "النظام" : "Suhail");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const describe = (f: FeedItem) => {
    const d = f.data || {};
    if (f.verb === "created") return lang === "ar" ? "أنشأ هذا" : "created this";
    if (f.verb === "submitted") return lang === "ar" ? "وصل الطلب" : "Application received";
    if (f.verb === "changed" && d.field) {
      const to = String(d.to ?? "");
      const pretty = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled", "none", "low", "med", "high", "urgent"].includes(to) ? tt(lang, to as TKey) : d.field === "assignee_id" ? name(to) : to;
      return d.field === "status" ? (lang === "ar" ? `نقلها إلى ${pretty}` : `moved this to ${pretty}`) : (lang === "ar" ? `غيّر ${String(d.field)} إلى ${pretty}` : `set ${String(d.field).replace("_id", "").replace("_on", "")} to ${pretty || "none"}`);
    }
    if (f.verb === "stage") return lang === "ar" ? `نقل الطلب إلى ${d.to}` : `moved to ${d.to}`;
    if (f.verb === "emailed") return lang === "ar" ? `أرسل «${d.subject}»` : `emailed "${d.subject}"`;
    if (f.verb === "scored") return lang === "ar" ? "قيّم الطلب" : "scored this";
    return String(f.verb);
  };
  return (
    <div className="feed">
      {items.map((f) => f.kind === "comment" ? (
        <div key={f.id} className="c"><Avatar name={name(f.actor)} /><div className="body"><span><span className="who">{name(f.actor)}</span> <span className="muted">{ago(lang, f.at)}</span></span><RichText doc={f.body as Doc} /></div></div>
      ) : (
        <div key={f.id} className="ev">{name(f.actor)} {describe(f)} · {ago(lang, f.at)}</div>
      ))}
      <Editor key={items.length} people={people} placeholder={placeholder ?? tt(lang, "commentPh")} minimal label={placeholder ?? tt(lang, "commentPh")}
        onSubmit={(doc, clear) => start(async () => {
          if (!(doc.content || []).some((n) => (n.content || []).length)) return;
          if (onSend) await onSend(doc); else await addComment({ entity_type: entity.type, entity_id: entity.id, body: doc as { type: "doc" } });
          clear(); toast(tt(lang, "saved")); if (onPosted) onPosted(); else router.refresh();
        })} />
      {pending ? <span className="muted" style={{ fontSize: ".75rem" }}>{tt(lang, "loading")}</span> : null}
    </div>
  );
}
