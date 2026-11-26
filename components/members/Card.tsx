import Link from "next/link";
import { initials } from "@/components/ui/Avatar";
import type { Member } from "@/lib/members";
import type { mt } from "@/lib/members-i18n";

/** A member's photo, or their initials on a quiet tile with the star when there's no photo. */
export function Photo({ m, src, className = "mb-photo" }: { m: Pick<Member, "name">; src?: string; className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="mb-ini">{initials(m.name)}</span>}
    </span>
  );
}

/** A member as a photo card: the picture first, then name, what they do, where, and what they're looking for. */
export function MemberCard({ m, t, src, note }: { m: Member; t: ReturnType<typeof mt>; src?: string; note?: string }) {
  return (
    <Link href={`/members/people/${m.id}`} className="mb-card">
      <Photo m={m} src={src} />
      <span className="mb-card-b">
        <span className="mb-card-n">{m.name}</span>
        <span className="mb-card-h">{m.headline || t.roles[m.role]}</span>
        <span className="mb-card-m">{[m.city, m.country].filter(Boolean).join(", ")}</span>
        {note ? <span className="chip attn">{note}</span> : m.looking_for[0] ? <span className="chip">{t.lookingFor}: {t.looking[m.looking_for[0]]}</span> : null}
      </span>
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
