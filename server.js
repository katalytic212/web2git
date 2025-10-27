const express = require("express");
const axios = require("axios");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const btoa = require("btoa");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const cssUrlRegex = /url\(["']?(.+?)["']?\)/g;
const jsUrlRegex = /['"]((https?:)?\/\/[^\s'"]+\.(png|jpg|jpeg|gif|svg|mp3|wav|css|js))['"]/g;

async function fetchSite(url, maxDepth = 1, depth = 0, collected = {}, originDomain = null) {
  if (depth > maxDepth || collected[url]) return collected;
  try {
    console.log(`📥 Baixando: ${url}`);
    const res = await axios.get(url, { responseType: "arraybuffer" });
    const contentType = res.headers["content-type"];
    const base = new URL(url).origin;
    const pathUrl = new URL(url).pathname === "/" ? "index.html" : new URL(url).pathname.slice(1);

    let content;
    let binary = false;
    if (!contentType.includes("text/html") && !contentType.includes("application/javascript") && !contentType.includes("text/css")) {
      content = Buffer.from(res.data).toString("base64");
      binary = true;
    } else {
      content = res.data.toString("utf-8");
    }

    collected[url] = { content, path: pathUrl || "index.html", binary };

    // HTML
    if (contentType.includes("text/html")) {
      const dom = new JSDOM(content);
      const doc = dom.window.document;
      if (!originDomain) originDomain = base;

      const assets = [...doc.querySelectorAll("img[src],audio[src],script[src],link[rel='stylesheet'][href]")];
      for (const el of assets) {
        const attr = el.getAttribute("src") || el.getAttribute("href");
        if (!attr) continue;
        const abs = new URL(attr, url).href;
        if (!collected[abs]) await fetchSite(abs, 0, 0, collected);
        const fileName = new URL(abs).pathname.slice(1) || "asset";
        if (el.getAttribute("src")) el.setAttribute("src", fileName);
        if (el.getAttribute("href")) el.setAttribute("href", fileName);
      }

      const links = [...doc.querySelectorAll("a[href]")];
      for (const link of links) {
        const href = link.getAttribute("href");
        if (!href) continue;
        const abs = new URL(href, url).href;
        if (abs.startsWith(originDomain) && !collected[abs]) {
          await fetchSite(abs, maxDepth, depth + 1, collected, originDomain);
        }
        if (abs.startsWith(originDomain)) {
          const pathRel = new URL(abs).pathname.slice(1) || "index.html";
          link.setAttribute("href", pathRel);
        }
      }

      collected[url].content = doc.documentElement.outerHTML;
    }

    // CSS
    if (contentType.includes("text/css")) {
      let cssText = content;
      let match;
      while ((match = cssUrlRegex.exec(cssText)) !== null) {
        try {
          const abs = new URL(match[1], url).href;
          if (!collected[abs]) await fetchSite(abs, 0, 0, collected);
          const fileName = new URL(abs).pathname.slice(1) || "asset";
          cssText = cssText.replace(match[1], fileName);
        } catch {}
      }
      collected[url].content = cssText;
    }

    // JS simples
    if (contentType.includes("javascript")) {
      let jsText = content;
      let match;
      while ((match = jsUrlRegex.exec(jsText)) !== null) {
        try {
          const abs = match[1].startsWith("http") ? match[1] : new URL(match[1], url).href;
          if (!collected[abs]) await fetchSite(abs, 0, 0, collected);
          const fileName = new URL(abs).pathname.slice(1) || "asset";
          jsText = jsText.split(match[1]).join(fileName);
        } catch {}
      }
      collected[url].content = jsText;
    }

  } catch (err) {
    console.log(`❌ Erro ao baixar ${url}: ${err.message}`);
  }
  return collected;
}

async function uploadToGitHub(repo, branch, token, files) {
  const api = `https://api.github.com/repos/${repo}`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json"
  };

  try {
    const mainRef = await axios.get(`${api}/git/ref/heads/main`, { headers });
    const baseSha = mainRef.data.object.sha;
    await axios.post(`${api}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: baseSha
    }, { headers }).catch(() => {});
  } catch {}

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
