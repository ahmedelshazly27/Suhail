import { t, type Lang } from "@/lib/i18n";

/** The prototype's own status messages for each problem. "rate" and "bot" reuse its generic "try again" line. */
export function problemText(lang: Lang, p: string) {
  const k = ({ required: "required", too_long: "too_long", bad_email: "bad_email", cv_need: "cv_need", cv_bad: "cv_bad", cv_noup: "cv_noup", bad_option: "required" } as const)[p as "required"];
  return t(lang, k ?? "err");
}
