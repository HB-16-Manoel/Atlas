import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { recognizeVision, ScanError } from "./vision.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 8 * 1024 * 1024;
const assets = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"] };

export function createAppServer({ recognize = recognizeVision } = {}) {
  return createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' blob:; connect-src 'self'; style-src 'self'; script-src 'self'");
    if (request.method === "GET" && assets[request.url]) {
      const [filename, type] = assets[request.url];
      response.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
      response.end(await readFile(join(directory, filename)));
      return;
    }
    if (request.method !== "POST" || request.url !== "/scan") {
      response.writeHead(404).end();
      return;
    }
    try {
      if (!request.headers["content-type"]?.startsWith("application/json")) throw new ScanError("Expected an image upload.");
      let size = 0;
      const chunks = [];
      for await (const chunk of request) {
        size += chunk.length;
        if (size > MAX_BODY) throw new ScanError("The image is too large.", 413);
        chunks.push(chunk);
      }
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { throw new ScanError("The upload could not be read."); }
      const result = await recognize(payload.image);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(result));
    } catch (error) {
      const status = error instanceof ScanError ? error.status : 500;
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof ScanError ? error.message : "Something went wrong. Please try again." }));
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  createAppServer().listen(4179, "127.0.0.1", () => {
    console.log("Local Smart Scan prototype: http://127.0.0.1:4179");
  });
}
