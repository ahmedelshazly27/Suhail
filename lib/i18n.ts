import strings from "@/content/strings.json";

export type Lang = "ar" | "en";
export const LANGS: Lang[] = ["ar", "en"];
export const isLang = (v: string): v is Lang => v === "ar" || v === "en";

type Dict = typeof strings.ar;
export type Key = { [K in keyof Dict]: Dict[K] extends string ? (Dict[K] extends `@fn:${string}` ? never : K) : never }[keyof Dict];

/** A prototype string, word for word. */
export function t(lang: Lang, key: Key): string {
  return (strings[lang] as Record<string, string>)[key] ?? "";
}

/** "N events" as the prototype counts them. */
export const evCount = (lang: Lang, n: number) => (lang === "ar" ? `${n} فعاليات` : `${n}${n === 1 ? " event" : " events"}`);

/** Public URL for a page in a language: Arabic is the default and has no prefix. */
export const href = (lang: Lang, path = "/") => (lang === "ar" ? path : path === "/" ? "/en" : `/en${path}`);
export const dir = (lang: Lang) => (lang === "ar" ? "rtl" : "ltr");
/** Pick the Arabic or English half of a [en, ar] pair, as the prototype stores them. */
export const pick = <T,>(lang: Lang, pair: readonly [T, T] | T[]) => pair[lang === "ar" ? 1 : 0];
