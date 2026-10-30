import { WordmarkAr } from "@/components/ui/Wordmark";

export const Mark = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M10 0 L11.6 8.4 L20 10 L11.6 11.6 L10 20 L8.4 11.6 L0 10 L8.4 8.4 Z" /></svg>
);
export const Brand = ({ lang }: { lang: "ar" | "en" }) => (
  <span className="brandmark"><Mark /><span className="w">{lang === "ar" ? <WordmarkAr /> : "Suhail"}</span><span className="t">{lang === "ar" ? "الفريق" : "Team"}</span></span>
);
