import type { Metadata } from "next";
import { Jobs } from "@/components/site/Jobs";
import { SoonBar } from "@/components/site/Soon";
import { t, type Lang } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/jobs">): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  return pageMeta(lang, "/jobs", "nav_jobs", t(lang, "jobs_lede"));
}

export default async function JobsPage({ params }: PageProps<"/[lang]/jobs">) {
  const lang = (await params).lang as Lang;
  return <section className="page on" data-page="jobs"><SoonBar lang={lang} /><Jobs lang={lang} /></section>;
}
