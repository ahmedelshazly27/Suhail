import "server-only";
import { cookies } from "next/headers";
import type { TLang } from "@/lib/team-i18n";

export type Theme = "light" | "dark" | "system";
export async function teamPrefs(): Promise<{ lang: TLang; theme: Theme }> {
  const c = await cookies();
  const lang = c.get("team-lang")?.value === "ar" ? "ar" : "en";
  const t = c.get("team-theme")?.value;
  return { lang, theme: t === "light" || t === "dark" ? t : "system" };
}
