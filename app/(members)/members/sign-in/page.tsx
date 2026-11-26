import Link from "next/link";
import { redirect } from "next/navigation";
import { LinkForm } from "@/components/members/Forms";
import { getMember, memberLang } from "@/lib/members";
import { mt } from "@/lib/members-i18n";

export const metadata = { title: "Sign in" };

export default async function Page({ searchParams }: PageProps<"/members/sign-in">) {
  const me = await getMember();
  if (me?.status === "active") redirect("/members");
  const t = mt(await memberLang(me));
  const e = (await searchParams).e;
  return (
    <section className="mb-narrow">
      <h1 className="mb-h1">{t.app}</h1>
      <p className="mb-lede">{t.inviteOnly}</p>
      {e === "paused" ? <p className="mb-err">{t.paused}</p> : e === "notMember" ? <p className="mb-err">{t.notMember}</p> : e ? <p className="mb-err">{t.error}</p> : null}
      <LinkForm t={t} />
      <p className="s">{t.haveInvite} <Link href="/members/apply">{t.apply}</Link></p>
    </section>
  );
}
