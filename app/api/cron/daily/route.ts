import { env } from "@/lib/env";
import { dueCards, emailDigest, renewMailSubscription, retention, standupPrompt, weeklyDigest } from "@/lib/jobs";

// Vercel Cron (vercel.json). Hobby runs crons once a day, so all daily work happens here; Monday adds the weekly digest.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}` || !env.cronSecret()) return new Response("Unauthorized", { status: 401 });
  const log: string[] = [];
  for (const job of [standupPrompt, dueCards, emailDigest, weeklyDigest, retention, renewMailSubscription]) {
    try { await job(log); } catch (e) { log.push(`${job.name} failed: ${(e as Error).message}`); }
  }
  return Response.json({ ok: true, log });
}
