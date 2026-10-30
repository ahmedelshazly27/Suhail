import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

/** The team feed URL is derived from a server secret, so it can be shared with the team but not guessed. */
export const teamToken = () => createHmac("sha256", env.cronSecret() || env.serviceRole() || "suhail").update("team-ics").digest("hex").slice(0, 32);

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const day = (iso: string) => iso.replace(/-/g, "");
export type IcsEvent = { uid: string; date: string; end?: string; title: string; url?: string; description?: string };

/** All-day events (RFC 5545). Outlook subscribes to the URL and refreshes it on its own schedule. */
export function ics(name: string, events: IcsEvent[]) {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Suhail//Team//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(name)}`, "X-PUBLISHED-TTL:PT1H"];
  for (const e of events) {
    const end = new Date((e.end ?? e.date) + "T12:00:00Z"); end.setUTCDate(end.getUTCDate() + 1);
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@suhail`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${day(e.date)}`, `DTEND;VALUE=DATE:${day(end.toISOString().slice(0, 10))}`, `SUMMARY:${esc(e.title)}`, ...(e.url ? [`URL:${e.url}`] : []), ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []), "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
