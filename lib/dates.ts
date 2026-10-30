// Dates as the team reads them. Everything is in the team's time zone (Asia/Kuwait by default).
import type { TLang } from "@/lib/team-i18n";
export const TZ = process.env.TEAM_TZ || "Asia/Kuwait";
const loc = (l: TLang) => (l === "ar" ? "ar-KW-u-nu-latn" : "en-GB");

export const todayISO = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
export const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
export const longDate = (l: TLang, d = new Date()) => new Intl.DateTimeFormat(loc(l), { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);
export const hourNow = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date()));

/** "Today", "Fri", "14 Nov": short and relative within a week, as in the mockups. */
export function dueLabel(l: TLang, iso: string | null): { text: string; cls: "" | "late" | "today" } {
  if (!iso) return { text: "", cls: "" };
  const t = todayISO(), diff = daysBetween(t, iso);
  if (diff === 0) return { text: l === "ar" ? "اليوم" : "Today", cls: "today" };
  if (diff === 1) return { text: l === "ar" ? "باكر" : "Tomorrow", cls: "" };
  if (diff < 0) return { text: l === "ar" ? `متأخرة ${-diff} يوم` : `Overdue ${-diff} d`, cls: "late" };
  const d = new Date(iso + "T12:00:00Z");
  if (diff < 7) return { text: new Intl.DateTimeFormat(loc(l), { weekday: "short", timeZone: "UTC" }).format(d), cls: "" };
  return { text: new Intl.DateTimeFormat(loc(l), { day: "numeric", month: "short", timeZone: "UTC" }).format(d), cls: "" };
}

export function ago(l: TLang, iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (l === "ar") return m < 60 ? `قبل ${m || 1} دقيقة` : m < 1440 ? `قبل ${Math.round(m / 60)} ساعة` : `قبل ${Math.round(m / 1440)} يوم`;
  return m < 60 ? `${m || 1} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
}
export const shortTime = (l: TLang, iso: string) => {
  const d = new Date(iso), today = todayISO() === todayISO(d);
  return new Intl.DateTimeFormat(loc(l), today ? { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false } : { timeZone: TZ, weekday: "short" }).format(d);
};
