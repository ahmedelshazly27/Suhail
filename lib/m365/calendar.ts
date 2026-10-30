import "server-only";
import { delegatedToken, graph, m365Live } from "./graph";

export interface CalendarProvider {
  readonly live: boolean;
  /** Hours away in a date range per person (out of office and busy blocks over 4 h), for sprint capacity. */
  awayDays(emails: string[], from: string, to: string): Promise<Record<string, number>>;
}

class GraphCalendar implements CalendarProvider {
  live = true;
  constructor(private token: string) {}
  async awayDays(emails: string[], from: string, to: string) {
    const j = await graph<{ value: { scheduleId: string; scheduleItems: { status: string; start: { dateTime: string }; end: { dateTime: string } }[] }[] }>(this.token, "/me/calendar/getSchedule", {
      method: "POST", body: JSON.stringify({ schedules: emails, startTime: { dateTime: from, timeZone: "UTC" }, endTime: { dateTime: to, timeZone: "UTC" }, availabilityViewInterval: 60 }),
    });
    const out: Record<string, number> = {};
    for (const s of j.value) {
      const hours = s.scheduleItems.filter((i) => i.status === "oof").reduce((n, i) => n + (Date.parse(i.end.dateTime) - Date.parse(i.start.dateTime)) / 36e5, 0);
      out[s.scheduleId.toLowerCase()] = Math.round(hours / 8);
    }
    return out;
  }
}
class NoCalendar implements CalendarProvider { live = false; async awayDays() { return {}; } }

export async function calendar(profileId: string): Promise<CalendarProvider> {
  if (m365Live()) { const t = await delegatedToken(profileId); if (t) return new GraphCalendar(t); }
  return new NoCalendar();
}
