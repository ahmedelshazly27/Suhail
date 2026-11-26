import { ApplyForm } from "@/components/members/Forms";
import { memberLang } from "@/lib/members";
import { mt } from "@/lib/members-i18n";

export const metadata = { title: "Apply" };

export default async function Page() {
  const t = mt(await memberLang());
  return (
    <section className="mb-narrow">
      <h1 className="mb-h1">{t.apply}</h1>
      <p className="mb-lede">{t.applyLede}</p>
      <ApplyForm t={t} />
    </section>
  );
}
