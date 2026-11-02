#!/usr/bin/env node
/**
 * Servidor local simples para ver o site (pasta dist/). Aceita "Range", necessário
 * para avançar e voltar no áudio. Uso: npm run servir   (porta padrão 4173; PORT=8080 muda)
 */
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const porta = Number(process.env.PORT) || 4173;
const tipos = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};

if (!existsSync(dist)) {
  console.error("A pasta dist/ não existe. Rode primeiro:  npm run build");
  process.exit(1);
}

http.createServer((req, res) => {
  let rel = decodeURIComponent((req.url || "/").split("?")[0]);
  if (rel.endsWith("/")) rel += "index.html";
  const arquivo = path.normalize(path.join(dist, rel));
  if (!arquivo.startsWith(dist) || !existsSync(arquivo) || !statSync(arquivo).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Não encontrado");
  }
  const { size } = statSync(arquivo);
  const cabecalho = { "Content-Type": tipos[path.extname(arquivo).toLowerCase()] || "application/octet-stream", "Accept-Ranges": "bytes" };
  const faixa = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (faixa) {
    const ini = faixa[1] === "" ? size - Number(faixa[2]) : Number(faixa[1]);
    const fim = faixa[1] === "" || faixa[2] === "" ? size - 1 : Math.min(Number(faixa[2]), size - 1);
    if (ini > fim || ini < 0 || ini >= size) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      return res.end();
    }
    res.writeHead(206, { ...cabecalho, "Content-Range": `bytes ${ini}-${fim}/${size}`, "Content-Length": fim - ini + 1 });
    return createReadStream(arquivo, { start: ini, end: fim }).pipe(res);
  }
  res.writeHead(200, { ...cabecalho, "Content-Length": size });
  createReadStream(arquivo).pipe(res);
}).listen(porta, () => console.log(`Site no ar: http://localhost:${porta}/  (Ctrl+C para parar)`));
