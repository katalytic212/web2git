const express = require("express");
const axios = require("axios");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");
const path = require("path");
const btoa = require("btoa");

const app = express();
app.use(express.json());
app.use(express.static("public"));

/**
 * Função para baixar site recursivamente
 */
async function fetchSite(url, maxDepth = 1, depth = 0, collected = {}, originDomain = null) {
  if (depth > maxDepth || collected[url]) return collected;
  try {
    console.log(`📥 Baixando: ${url}`);
    const res = await axios.get(url, { responseType: "arraybuffer" });
    const contentType = res.headers["content-type"];
    const base = new URL(url).origin;
    const pathUrl = new URL(url).pathname === "/" ? "index.html" : new URL(url).pathname.slice(1);
    
    // Converte binário para Base64 se não for HTML
    let content;
    let binary = false;
    if (!contentType.includes("text/html")) {
      content = Buffer.from(res.data).toString("base64");
      binary = true;
    } else {
      content = res.data.toString("utf-8");
    }

    collected[url] = { content, path: pathUrl || "index.html", binary };

    if (contentType.includes("text/html")) {
      const dom = new JSDOM(content);
      const doc = dom.window.document;

      if (!originDomain) originDomain = base;

      // Assets: img, audio, script, link rel=stylesheet
      const assets = [...doc.querySelectorAll("img[src],audio[src],script[src],link[rel='stylesheet'][href]")];
      for (const el of assets) {
        const attr = el.getAttribute("src") || el.getAttribute("href");
        if (!attr) continue;
        const abs = new URL(attr, url).href;
        if (!collected[abs]) {
          await fetchSite(abs, 0, 0, collected);
        }
      }

      // Links internos
      const links = [...doc.querySelectorAll("a[href]")];
      for (const link of links) {
        let href = link.getAttribute("href");
        if (!href) continue;
        const abs = new URL(href, url).href;
        if (abs.startsWith(originDomain) && !collected[abs]) {
          await fetchSite(abs, maxDepth, depth + 1, collected, originDomain);
        }
      }
    }
  } catch (err) {
    console.log(`❌ Erro ao baixar ${url}: ${err.message}`);
  }
  return collected;
}

/**
 * Upload para GitHub via API
 */
async function uploadToGitHub(repo, branch, token, files) {
  const api = `https://api.github.com/repos/${repo}`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json"
  };

  // Cria branch se não existir
  try {
    const mainRef = await axios.get(`${api}/git/ref/heads/main`, { headers });
    const baseSha = mainRef.data.object.sha;
    await axios.post(`${api}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: baseSha
    }, { headers }).catch(() => {});
  } catch {}

  // Envia cada arquivo
  for (const f of Object.values(files)) {
    const content = f.binary ? f.content : btoa(unescape(encodeURIComponent(f.content)));
    await axios.put(`${api}/contents/${f.path}`, {
      message: `Adicionar ${f.path}`,
      content,
      branch
    }, { headers });
  }
}

app.post("/clone", async (req, res) => {
  const { siteUrl, repo, token, branch, depth } = req.body;
  if (!siteUrl || !repo || !token) return res.status(400).send("Preencha todos os campos!");
  try {
    const files = await fetchSite(siteUrl, depth || 1);
    await uploadToGitHub(repo, branch || "gh-pages", token, files);
    res.json({ status: "ok", message: "Site clonado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.listen(3000, () => console.log("Servidor rodando em http://localhost:3000"));
