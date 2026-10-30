import { unsubscribeToken } from "@/app/actions/public";

// RFC 8058 one-click unsubscribe (List-Unsubscribe-Post). Mail clients POST here without a page view.
export async function POST(req: Request) {
  const t = new URL(req.url).searchParams.get("t") || "";
  const ok = await unsubscribeToken(t);
  return new Response(null, { status: ok ? 200 : 400 });
}
