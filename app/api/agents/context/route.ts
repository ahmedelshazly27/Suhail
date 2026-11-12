import { agentAuth, section, SECTIONS, type Section } from "@/lib/agents";

// A deeper look at one part of the dashboard during a run: ?section=relationships&q=hub71
export async function GET(req: Request) {
  if (!(await agentAuth(req))) return new Response("Unauthorized", { status: 401 });
  const u = new URL(req.url);
  const s = u.searchParams.get("section") as Section;
  if (!(SECTIONS as readonly string[]).includes(s)) return new Response(`section must be one of: ${SECTIONS.join(", ")}`, { status: 400 });
  const out = await section(s, { q: u.searchParams.get("q") || "", limit: 300 });
  return new Response(out || "Nothing found.", { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" } });
}
