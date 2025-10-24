const http = require("http"),
  https = require("https"),
  net = require("net"),
  tls = require("tls"),
  { URL: URL } = require("url");

const args = process.argv.slice(2);
const verbose = process.argv.includes("-v");
const filtered = args.filter((a) => a !== "-v");

const envTarget = process.env.TARGET || filtered[0] || "https://truffled.lol";
const listenPort = process.env.PORT || filtered[1] || 8080;

let target;
try {
  target = new URL(envTarget);
} catch {
  console.error("Invalid TARGET URL:", envTarget);
  process.exit(1);
}

const targetIsHttps = target.protocol === "https:";
const targetDefaultPort = target.port || (targetIsHttps ? 443 : 80);

function clientModule(t) {
  return t.protocol === "https:" ? https : http;
}

console.log(
  `Reverse proxy starting:\n  Proxy listens on :${listenPort}\n  Target: ${target.origin} (port ${targetDefaultPort})\n`,
);

const server = http.createServer((t, e) => {
  const r = t.url || "/";
  const o = {
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
        e.hostname = r.split(":")[0];
        if (r.includes(":")) e.port = r.split(":")[1];
        const s =
          t.headers["x-forwarded-proto"] ||
          (t.socket.encrypted ? "https" : "http");
        e.protocol = s + ":";
        o.location = e.toString();
      } catch {}

    Object.entries(o).forEach(([t, r]) => {
      try {
        e.setHeader(t, r);
      } catch {}
    });

    e.writeHead(r.statusCode);
    r.pipe(e, { end: true });
  });

  n.on("error", () => {
    if (!e.headersSent) {
      e.statusCode = 502;
      e.setHeader("content-type", "text/plain; charset=utf-8");
    }
    e.end("Bad Gateway");
  });

  t.pipe(n, { end: true });
});

server.on("upgrade", (t, e, r) => {
  const o = targetIsHttps,
    s = target.port || (o ? 443 : 80),
    n = target.hostname;
  if (o) {
    const o = tls.connect(s, n, { servername: n }, () => {
      o.write(a(t)), r && r.length && o.write(r), e.pipe(o).pipe(e);
    });
    o.on("error", () => e.destroy());
  } else {
    const o = net.connect(s, n, () => {
      o.write(a(t)), r && r.length && o.write(r), e.pipe(o).pipe(e);
    });
    o.on("error", () => e.destroy());
  }
  function a(t) {
    const e = ("/" === target.pathname ? "" : target.pathname) + (t.url || "/");
    let r = `${t.method} ${e} HTTP/${t.httpVersion}\r\n`;
    const o = Object.assign({}, t.headers);
    o.host = target.host;
    delete o.connection;
    Object.keys(o).forEach((t) => {
      r += `${t}: ${o[t]}\r\n`;
    });
    r += "\r\n";
    return r;
  }
});

server.on("request", (t, e) => {
  if (verbose)
    console.log(
      `${new Date().toISOString()} -> ${t.method} ${t.url} from ${t.socket.remoteAddress}`,
    );
});

server.on("clientError", () => {});

server.listen(listenPort, () => {
  console.log(
    `Proxy running at http://localhost:${listenPort} -> ${target.origin}`,
  );
});
