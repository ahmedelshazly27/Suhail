import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// 1. team.<domain> serves the dashboard: /x on that host is /team/x in the app, and /team on the public host
//    redirects there.
// 2. Public pages: Arabic lives at /, English at /en. Un-prefixed paths are rewritten to /ar internally.
// 3. Dashboard requests refresh the Supabase session cookie.
export async function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = (req.headers.get("host") || "").split(":")[0];
  const teamHost = process.env.TEAM_HOST;

  if (teamHost && host === teamHost && !url.pathname.startsWith("/team") && !url.pathname.startsWith("/api") && !url.pathname.startsWith("/auth")) {
    url.pathname = url.pathname === "/" ? "/team" : `/team${url.pathname}`;
    return withSession(req, NextResponse.rewrite(url));
  }
  if (teamHost && host !== teamHost && url.pathname.startsWith("/team") && !host.endsWith(".vercel.app") && host !== "localhost") {
    return NextResponse.redirect(`https://${teamHost}${url.pathname}${url.search}`, 308); // one host, so one session cookie
  }
  if (url.pathname.startsWith("/team") || url.pathname.startsWith("/auth")) return withSession(req, NextResponse.next({ request: req }));
  if (url.pathname.startsWith("/api")) return NextResponse.next();

  if (url.pathname === "/ar" || url.pathname.startsWith("/ar/")) {
    url.pathname = url.pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }
  if (url.pathname === "/en" || url.pathname.startsWith("/en/")) return NextResponse.next();
  url.pathname = `/ar${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

async function withSession(req: NextRequest, res: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anon) return res;
  const supabase = createServerClient(supabaseUrl, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });
  try {
    await supabase.auth.getClaims(); // refreshes an expired session; verified locally, so no Auth round trip otherwise
  } catch {
    // Database unreachable: pages handle the signed-out state.
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|opengraph-image|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml|webmanifest|js|css|woff2?)$).*)"],
};
