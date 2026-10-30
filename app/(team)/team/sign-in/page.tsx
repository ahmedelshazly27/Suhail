import { redirect } from "next/navigation";
import { signInWithMicrosoft } from "@/app/actions/auth";
import { Brand } from "@/components/team/Mark";
import { OwnerLinkForm } from "@/components/team/OwnerLinkForm";
import { getMe } from "@/lib/auth";
import { env } from "@/lib/env";
import { tt } from "@/lib/team-i18n";
import { teamPrefs } from "@/lib/team-prefs";

export const metadata = { title: "Sign in" };
const ERR: Record<string, { en: string; ar: string }> = {
  noaccess: { en: "Your account isn't in a Suhail group yet. Ask an owner to add you to suhail-team in Microsoft 365.", ar: "حسابك مو في مجموعة سهيل للحين. اطلب من المالك يضيفك لمجموعة suhail-team في Microsoft 365." },
  azure: { en: "Microsoft sign-in is being set up. Use the owner link below for now.", ar: "دخول Microsoft قيد الإعداد. استخدم رابط المالك تحت للحين." },
};

export default async function SignIn({ searchParams }: PageProps<"/team/sign-in">) {
  const me = await getMe();
  if (me?.active) redirect("/team");
  const { lang } = await teamPrefs();
  const e = (await searchParams).e;
  const err = typeof e === "string" ? ERR[e] ?? { en: "Sign-in didn't complete. Try again.", ar: "ما كمل الدخول. جرّب مرة ثانية." } : null;
  return (
    <main className="signin">
      <div className="dither" aria-hidden="true" />
      <div className="signin-box">
        <Brand lang={lang} />
        <div className="signin-card">
          <h1>{tt(lang, "welcome")}</h1>
          <p>{tt(lang, "signInLede")}</p>
          <form action={signInWithMicrosoft}><button className="b" type="submit" disabled={!env.azureReady()}>{tt(lang, "signInMs")}</button></form>
          <small>{tt(lang, "signInNote")}</small>
          {err ? <p role="alert" style={{ color: "var(--st-danger)", fontSize: ".8125rem" }}>{err[lang]}</p> : null}
          {env.devLogin() ? <><div className="sect-h" style={{ textAlign: "start" }}>{tt(lang, "devLogin")}</div><OwnerLinkForm lang={lang} /></> : null}
        </div>
        <small className="muted" style={{ fontSize: ".75rem" }}>{tt(lang, "teamsNote")}</small>
      </div>
    </main>
  );
}
