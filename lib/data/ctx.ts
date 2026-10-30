import "server-only";
import { getShell } from "@/lib/data/shell";
import { getLabels, getSprints } from "@/lib/data/tickets";
import { teamPrefs } from "@/lib/team-prefs";
import type { Me } from "@/lib/auth";

/** What every ticket view needs: language, people, projects, sprints, labels. */
export async function ticketCtx(me: Me) {
  const [{ lang }, shell, sprints, labels] = await Promise.all([teamPrefs(), getShell(me.id), getSprints(), getLabels()]);
  return { lang, people: shell.people, projects: shell.projects, sprints, labels };
}
