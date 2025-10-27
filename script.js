const logBox = document.getElementById("log");
function log(msg) {
  console.log(msg);
  logBox.value += msg + "\n";
  logBox.scrollTop = logBox.scrollHeight;
}

// Proxy público para contornar CORS
async function fetchWithProxy(url) {
  try {
    const proxy = "https://api.allorigins.win/get?url=" + encodeURIComponent(url);
    const res = await fetch(proxy);
    const data = await res.json();
    return data.contents;
  } catch (err) {
    log(`❌ Falha ao buscar ${url}: ${err.message}`);
    return null;
  }
}

// Baixa uma página e seus recursos (HTML, CSS, JS, IMG, AUDIO)
async function fetchPage(url, depth, maxDepth, collected) {
  if (depth > maxDepth || collected[url]) return;
  log(`📥 Baixando: ${url}`);
  const html = await fetchWithProxy(url);
  if (!html) return;

  const baseUrl = new URL(url).origin;
  collected[url] = { content: html, path: new URL(url).pathname.slice(1) || "index.html" };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const assets = [...doc.querySelectorAll("img[src],audio[src],script[src],link[rel='stylesheet'][href],a[href]")];

  for (const el of assets) {
    let attr = el.getAttribute("src") || el.getAttribute("href");
    if (!attr) continue;
    const absUrl = new URL(attr, url).href;

    // Clona apenas recursos do mesmo site ou externos
    if (el.tagName.toLowerCase() === "a" && absUrl.startsWith(baseUrl)) {
      await fetchPage(absUrl, depth + 1, maxDepth, collected);
    } else if (["img","audio","script","link"].includes(el.tagName.toLowerCase())) {
      if (!collected[absUrl]) {
        const content = await fetchWithProxy(absUrl);
        if (content) {
          collected[absUrl] = { content, path: new URL(absUrl).pathname.slice(1) || "asset" };
          log(`📦 Recurso: ${absUrl}`);
        }
      }
    }
  }
}

// Upload para GitHub
async function uploadToGitHub(repo, branch, token, files) {
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json"
  };
  const api = `https://api.github.com/repos/${repo}`;

  for (const f of Object.values(files)) {
    const content = btoa(unescape(encodeURIComponent(f.content)));
    await fetch(`${api}/contents/${f.path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ message: `Adicionar ${f.path}`, content, branch })
    });
    log(`🚀 Enviado: ${f.path}`);
  }
}

document.getElementById("cloneBtn").onclick = async () => {
  const siteUrl = document.getElementById("siteUrl").value.trim();
  const repo = document.getElementById("repo").value.trim();
  const token = document.getElementById("token").value.trim();
  const branch = document.getElementById("branch").value.trim() || "gh-pages";
  const maxDepth = parseInt(document.getElementById("depth").value) || 1;

  if (!siteUrl || !repo || !token) {
    alert("Preencha todos os campos!");
    return;
  }

  log("🔍 Iniciando clonagem...");
  const files = {};
  await fetchPage(siteUrl, 0, maxDepth, files);

  log("📤 Enviando arquivos para GitHub...");
  await uploadToGitHub(repo, branch, token, files);

  log("✅ Concluído! Ative GitHub Pages para ver seu site.");
};
