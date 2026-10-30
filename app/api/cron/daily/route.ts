import { env } from "@/lib/env";
import { recheckAccess } from "@/lib/auth";
import { appToken, m365Live } from "@/lib/m365/graph";
import { dueCards, emailDigest, renewMailSubscription, retention, standupPrompt, weeklyDigest } from "@/lib/jobs";

// Vercel Cron (vercel.json). Hobby runs crons once a day, so all daily work happens here; Monday adds the weekly digest.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}` || !env.cronSecret()) return new Response("Unauthorized", { status: 401 });
  const log: string[] = [];
  // Access first: someone removed from the Entra groups or disabled stops having access today.
  const access = async function accessRecheck(l: string[]) { if (m365Live()) l.push(`access recheck: ${await recheckAccess(await appToken())} deactivated`); };
  for (const job of [access, standupPrompt, dueCards, emailDigest, weeklyDigest, retention, renewMailSubscription]) {
    try { await job(log); } catch (e) { log.push(`${job.name} failed: ${(e as Error).message}`); }
  }
  return Response.json({ ok: true, log });
}
