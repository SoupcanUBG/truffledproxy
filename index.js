const http = require("http"),
  https = require("https"),
  net = require("net"),
  tls = require("tls"),
  { URL: URL } = require("url"),
  args = process.argv.slice(2),
  envTarget = process.env.TARGET || args[0] || "https://truffled.lol",
  listenPort = process.env.PORT || args[1] || 8080;
let target;
try {
  target = new URL(envTarget);
} catch (t) {
  (console.error("Invalid TARGET URL:", envTarget), process.exit(1));
}
const targetIsHttps = "https:" === target.protocol,
  targetDefaultPort = target.port || (targetIsHttps ? 443 : 80);
function clientModule(t) {
  return "https:" === t.protocol ? https : http;
}
console.log(
  `Reverse proxy starting:\n  Proxy listens on :${listenPort}\n  Target: ${target.origin} (port ${targetDefaultPort})\n`,
);
const server = http.createServer((t, e) => {
  const r = t.url || "/",
    o = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (targetIsHttps ? 443 : 80),
      method: t.method,
      path: ("/" === target.pathname ? "" : target.pathname) + r,
      headers: Object.assign({}, t.headers),
    };
  o.headers.host = target.host;
  const s = [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
  ];
  for (const t of s) delete o.headers[t];
  const n = clientModule(target).request(o, (r) => {
    const o = Object.assign({}, r.headers);
    if (o.location)
      try {
        const e = new URL(o.location, target.origin),
          r = t.headers.host || `localhost:${listenPort}`;
        ((e.hostname = r.split(":")[0]),
          r.includes(":") && (e.port = r.split(":")[1]));
        const s =
          t.headers["x-forwarded-proto"] ||
          (t.socket.encrypted ? "https" : "http");
        ((e.protocol = s + ":"), (o.location = e.toString()));
      } catch (t) {}
    (Object.entries(o).forEach(([t, r]) => {
      try {
        e.setHeader(t, r);
      } catch (t) {}
    }),
      e.writeHead(r.statusCode),
      r.pipe(e, { end: !0 }));
  });
  (n.on("error", (t) => {
    (console.error("Backend request error:", t && t.message),
      e.headersSent ||
        ((e.statusCode = 502),
        e.setHeader("content-type", "text/plain; charset=utf-8")),
      e.end("Bad Gateway"));
  }),
    t.pipe(n, { end: !0 }));
});
(server.on("upgrade", (t, e, r) => {
  const o = targetIsHttps,
    s = target.port || (o ? 443 : 80),
    n = target.hostname;
  if (o) {
    const o = tls.connect(s, n, { servername: n }, () => {
      (o.write(a(t)), r && r.length && o.write(r), e.pipe(o).pipe(e));
    });
    o.on("error", (t) => {
      (console.error("WSS proxy tls error:", t && t.message), e.destroy());
    });
  } else {
    const o = net.connect(s, n, () => {
      (o.write(a(t)), r && r.length && o.write(r), e.pipe(o).pipe(e));
    });
    o.on("error", (t) => {
      (console.error("WS proxy socket error:", t && t.message), e.destroy());
    });
  }
  function a(t) {
    const e = ("/" === target.pathname ? "" : target.pathname) + (t.url || "/");
    let r = `${t.method} ${e} HTTP/${t.httpVersion}\r\n`;
    const o = Object.assign({}, t.headers);
    return (
      (o.host = target.host),
      delete o.connection,
      Object.keys(o).forEach((t) => {
        r += `${t}: ${o[t]}\r\n`;
      }),
      (r += "\r\n"),
      r
    );
  }
}),
  server.on("request", (t, e) => {
    console.log(
      `${new Date().toISOString()} -> ${t.method} ${t.url} from ${t.socket.remoteAddress}`,
    );
  }),
  server.on("clientError", (t, e) => {
    console.error("Client error:", t && t.message);
    try {
      e.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    } catch (t) {}
  }),
  server.listen(listenPort, () => {
    console.log(
      `Proxy running at http://localhost:${listenPort} -> ${target.origin}`,
    );
  }));
