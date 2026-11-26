import Link from "next/link";
import { JoinForm } from "@/components/members/Forms";
import { inviteValid, memberLang } from "@/lib/members";
import { mt } from "@/lib/members-i18n";

export const metadata = { title: "Join" };

export default async function Page({ params, searchParams }: PageProps<"/members/join/[code]">) {
  const { code } = await params;
  const t = mt(await memberLang());
  const inv = (await searchParams).e ? null : await inviteValid(code);
  return (
    <section className="mb-narrow">
      <h1 className="mb-h1">{t.join}</h1>
      {inv ? <><p className="mb-lede">{t.joinLede}</p><JoinForm t={t} code={code} email={inv.email} /></>
        : <><p className="mb-err">{t.badInvite}</p><p className="s"><Link href="/members/apply">{t.apply}</Link> · <Link href="/members/sign-in">{t.signIn}</Link></p></>}
    </section>
  );
}
