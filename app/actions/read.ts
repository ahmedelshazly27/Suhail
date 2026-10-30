"use server";
import { requireMe } from "@/lib/auth";
import { getTicket } from "@/lib/data/tickets";

/** For the peek panel: the same data the full ticket page renders. */
export async function loadTicket(key: string) {
  await requireMe();
  return getTicket(key);
}
