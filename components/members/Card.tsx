import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { Member } from "@/lib/members";
import type { mt } from "@/lib/members-i18n";

/** A member as a card in a row: photo or initials, name, headline, where they are. */
export function MemberCard({ m, t, note }: { m: Member; t: ReturnType<typeof mt>; note?: string }) {
  return (
    <Link href={`/members/people/${m.id}`} className="mb-card">
      <Avatar name={m.name} src={m.avatar_url} size="lg" />
      <span className="mb-card-n">{m.name}</span>
      <span className="mb-card-h">{m.headline || t.roles[m.role]}</span>
      <span className="mb-card-m">{[m.city, m.country].filter(Boolean).join(", ")}</span>
      {note ? <span className="chip attn">{note}</span> : m.looking_for[0] ? <span className="chip">{t.looking[m.looking_for[0]]}</span> : null}
    </Link>
  );
}

export function Section({ title, sub, more, children }: { title: string; sub?: string; more?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="mb-sec">
      <div className="mb-sec-h"><div><h2>{title}</h2>{sub ? <p className="s">{sub}</p> : null}</div>{more ? <Link href={more.href} className="s">{more.label}</Link> : null}</div>
      {children}
    </section>
  );
}
