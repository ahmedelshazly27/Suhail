"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createNextSprint } from "@/app/actions/sprints";
import type { TLang } from "@/lib/team-i18n";

export function CreateSprint({ lang }: { lang: TLang }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <button type="button" className="b" disabled={pending} onClick={() => start(async () => { await createNextSprint(); router.refresh(); })}>{lang === "ar" ? "أنشئ الدورة الجاية" : "Create the next sprint"}</button>;
}
