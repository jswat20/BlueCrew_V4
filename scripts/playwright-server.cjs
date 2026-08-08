const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = 5501;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm" };

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  if (pathname === "/config/supabase.js") {
    response.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
    response.end('window.BLUECREW_RUNTIME_CONFIG=window.BLUECREW_RUNTIME_CONFIG||Object.freeze({mode:window.BLUECREW_SUPABASE_CONFIG?.url?"hosted":"local"});window.BLUECREW_SUPABASE_CONFIG=window.BLUECREW_SUPABASE_CONFIG||Object.freeze({mode:"local",url:"",publishableKey:""});');
    return;
  }
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404); response.end("Not found"); return;
  }
  response.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => process.stdout.write(`Playwright server listening on http://127.0.0.1:${port}\n`));
