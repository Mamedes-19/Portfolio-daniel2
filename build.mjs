#!/usr/bin/env node
/**
 * Gera a pasta dist/ com o site pronto para publicar (HTML, CSS inline, JS, áudio, imagens e fontes).
 * Uso: npm run build
 */
import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(raiz, "dist");
const aqui = (...p) => path.join(raiz, ...p);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kb = (n) => (n / 1024).toFixed(1) + " KB";

/* ---- Framer Motion: usa o pacote do npm; se não existir, usa a cópia em vendor/ ---- */
const alias = {};
if (!existsSync(aqui("node_modules", "framer-motion"))) {
  const v = aqui("vendor", "motion");
  if (!existsSync(v)) {
    console.error("\nFaltam as dependências. Rode primeiro:  npm install\n");
    process.exit(1);
  }
  alias["framer-motion"] = path.join(v, "framer-motion/src/index.ts");
  alias["motion-dom"] = path.join(v, "motion-dom/src/index.ts");
  alias["motion-utils"] = path.join(v, "motion-utils/src/index.ts");
}

/* ---- 1. Dados (site.ts e livros.ts) lidos aqui no Node, para título, SEO e <noscript> ---- */
const dadosBundle = await build({
  stdin: {
    contents: "export { site } from './site'; export { livros } from './livros';",
    resolveDir: aqui("src", "data"),
    loader: "ts",
  },
  bundle: true, write: false, format: "esm", platform: "node", logLevel: "warning",
});
const { site, livros } = await import(
  "data:text/javascript;base64," + Buffer.from(dadosBundle.outputFiles[0].text).toString("base64")
);

/* ---- 2. JS + CSS ---- */
await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, "assets"), { recursive: true });

const r = await build({
  entryPoints: { app: aqui("src", "main.tsx") },
  outdir: path.join(dist, "assets"),
  entryNames: "[name]-[hash]",
  bundle: true, minify: true, format: "iife", target: "es2020",
  jsx: "automatic", legalComments: "none", metafile: true, logLevel: "warning",
  define: { "process.env.NODE_ENV": '"production"' },
  external: ["*.woff2"], // as fontes ficam em public/fonts e são lidas pelo caminho escrito no CSS
  alias,
});
const saidas = Object.keys(r.metafile.outputs).map((f) => path.basename(f));
const arqJs = saidas.find((f) => f.endsWith(".js"));
const arqCss = saidas.find((f) => f.endsWith(".css"));
const css = await readFile(path.join(dist, "assets", arqCss), "utf8");

/* ---- 3. HTML ---- */
const principal = livros.find((l) => l.audiobook?.arquivo) ?? livros[0];
const titulo = `${site.estudante.nome}, portfólio literário | ${site.projeto.nome}`;
const url = (site.seo.urlDoSite || "").replace(/\/?$/, "/");
const og = [
  `<meta property="og:type" content="website">`,
  `<meta property="og:locale" content="pt_BR">`,
  `<meta property="og:site_name" content="${esc(site.projeto.nome)}">`,
  `<meta property="og:title" content="${esc(titulo)}">`,
  `<meta property="og:description" content="${esc(site.seo.descricao)}">`,
  site.seo.urlDoSite && `<meta property="og:url" content="${esc(url)}">`,
  site.seo.urlDoSite && principal && `<meta property="og:image" content="${esc(url + principal.capa)}">`,
  `<meta name="twitter:card" content="${site.seo.urlDoSite && principal ? "summary_large_image" : "summary"}">`,
].filter(Boolean).join("\n");

const noscript = `<noscript><div style="max-width:40rem;margin:0 auto;padding:2.5rem 1.25rem;font:1.0625rem/1.6 Georgia,serif;color:#131829;background:#F4F2EF">
<h1 style="font-size:2rem;line-height:1.15">${esc(site.estudante.nome)}</h1>
<p>${esc(site.apresentacaoCurta)}</p>
${livros.map((l) => `<h2 style="font-size:1.4rem">${esc(l.titulo)}, de ${esc(l.autor)}</h2><p>${esc(l.descricaoCurta)}</p>${l.audiobook?.arquivo ? `<p><audio controls preload="none" src="${esc(l.audiobook.arquivo)}" style="width:100%"></audio></p>` : ""}`).join("\n")}
<p><small>Para ver o portfólio completo, ative o JavaScript do navegador.</small></p></div></noscript>`;

let html = await readFile(aqui("index.html"), "utf8");
const trocas = {
  "%%TITULO%%": esc(titulo),
  "%%DESCRICAO%%": esc(site.seo.descricao),
  "%%ROBOTS%%": site.seo.indexavel ? "" : '<meta name="robots" content="noindex, nofollow">',
  "%%OG%%": og,
  "%%PRELOADS%%": [
    '<link rel="preload" href="fonts/literata-var.woff2" as="font" type="font/woff2" crossorigin>',
    '<link rel="preload" href="fonts/hanken-grotesk-var.woff2" as="font" type="font/woff2" crossorigin>',
  ].join("\n"),
  "%%CSS%%": `<style>${css}</style>`,
  "%%NOSCRIPT%%": noscript,
  "%%JS%%": `<script defer src="assets/${arqJs}"></script>`,
};
for (const [chave, valor] of Object.entries(trocas)) html = html.split(chave).join(valor);
await writeFile(path.join(dist, "index.html"), html);

/* ---- 4. Arquivos públicos (áudio, capas, fontes, favicon...) ---- */
await cp(aqui("public"), dist, { recursive: true });
await writeFile(path.join(dist, ".nojekyll"), "");
await rm(path.join(dist, "assets", arqCss)); // o CSS já está dentro do HTML

// robots.txt acompanha o mesmo interruptor ("indexavel" em src/data/site.ts) da etiqueta <meta name="robots">
await writeFile(
  path.join(dist, "robots.txt"),
  site.seo.indexavel
    ? "User-agent: *\nDisallow:\n"
    : '# Portfólio escolar: sem indexação em buscadores. Para permitir, mude "indexavel" para true em src/data/site.ts.\nUser-agent: *\nDisallow: /\n',
);

/* ---- Resumo ---- */
const tam = (f) => statSync(path.join(dist, f)).size;
const js = await readFile(path.join(dist, "assets", arqJs));
console.log("\nSite gerado em dist/");
console.log("  index.html  %s (CSS embutido: %s)", kb(tam("index.html")), kb(Buffer.byteLength(css)));
console.log("  %s  %s (%s com gzip)", arqJs, kb(js.length), kb(gzipSync(js).length));
console.log("  arquivos:", readdirSync(dist).join(", "));
console.log("\nPara ver no computador:  npm run servir\n");
