// One port, Supabase's URL layout: /rest/v1 -> PostgREST, /auth/v1 -> GoTrue. Storage and Realtime are not emulated.
import http from "node:http";
const routes = [["/rest/v1", 3001], ["/auth/v1", 9999]];
http.createServer((req, res) => {
  const r = routes.find(([p]) => req.url.startsWith(p));
  if (!r) { res.writeHead(501, { "content-type": "application/json" }); return res.end('{"message":"not emulated locally"}'); }
  const up = http.request({ host: "127.0.0.1", port: r[1], path: req.url.slice(r[0].length) || "/", method: req.method, headers: { ...req.headers, host: `127.0.0.1:${r[1]}` } }, (u) => {
    res.writeHead(u.statusCode, u.headers); u.pipe(res);
  });
  up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).listen(54321, () => console.log("local supabase on :54321"));
