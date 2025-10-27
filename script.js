// 📌 Elementos da interface
const logBox = document.getElementById("log");

// Função de log interativo
function log(msg) {
  console.log(msg);
  logBox.textContent += msg + "\n";
  logBox.scrollTop = logBox.scrollHeight;
}

// Tutorial para gerar Fine-Grained Token
document.getElementById("tutorialLink").onclick = (e) => {
  e.preventDefault();
  alert(`
🧩 COMO GERAR UM FINE-GRAINED TOKEN NO GITHUB

1️⃣ Acesse: https://github.com/settings/personal-access-tokens
2️⃣ Clique em "Fine-grained tokens" > "Generate new token"
3️⃣ Dê um nome (ex: "CloneSite")
4️⃣ Em "Repository access": escolha "Only select repositories" e selecione o repositório alvo
5️⃣ Em "Permissions":
    ✅ Contents → Read and Write
    ✅ Metadata → Read-only
6️⃣ Clique em "Generate token"
7️⃣ Copie o token (começa com "github_pat_...")

⚠️ Guarde-o com segurança!
`);
};

// Função para baixar assets (imagens, áudios, css, js)
async function fetchAsset(url, collected) {
  if (collected[url]) return;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const reader = new FileReader();
    reader.onloadend = () => {
      const basePath = new URL(url).pathname.slice(1) || "asset";
      collected[url] = { content: reader.result.split(",")[1], path: basePath, binary: true };
      log(`📦 Recurso: ${basePath}`);
    };
    reader.readAsDataURL(blob);
  } catch (err) {
    log(`⚠️ Falha ao baixar ${url}: ${err.message}`);
  }
}

// Função principal para baixar HTML e assets
async function fetchSite(url, depth = 0, maxDepth = 1, collected = {}) {
  if (depth > maxDepth || collected[url]) return collected;
  try {
    log(`📥 Baixando: ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    const contentType = res.headers.get("content-type") || "";
    const base = new URL(url).origin;
    const path = new URL(url).pathname === "/" ? "index.html" : new URL(url).pathname.slice(1);
    collected[url] = { content: await res.text(), path: path || "index.html" };

    if (contentType.includes("text/html")) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(collected[url].content, "text/html");
      const assets = [...doc.querySelectorAll("img[src],audio[src],script[src],link[rel='stylesheet'][href]")];

      for (const el of assets) {
        const attr = el.getAttribute("src") || el.getAttribute("href");
        if (!attr) continue;
        const abs = new URL(attr, url).href;
        if (abs.startsWith(base)) {
          await fetchAsset(abs, collected);
        }
      }
    }
  } catch (err) {
    log(`❌ Erro ao baixar ${url}: ${err.message}`);
  }
  return collected;
}

// Função para enviar arquivos para GitHub
async function uploadToGitHub(repo, branch, token, files) {
  const api = `https://api.github.com/repos/${repo}`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json"
  };

  log(`🚀 Enviando arquivos para ${repo}:${branch}`);

  // Cria branch se não existir
  const mainRef = await fetch(`${api}/git/ref/heads/main`, { headers });
  const base = await mainRef.json();
  if (base && base.object) {
    await fetch(`${api}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha })
    }).catch(() => {});
  }

  for (const f of Object.values(files)) {
    const content = f.binary ? f.content : btoa(unescape(encodeURIComponent(f.content)));
    await fetch(`${api}/contents/${f.path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `Adicionar ${f.path}`,
        content,
        branch
      })
    });
  }

  log("✅ Upload concluído!");
  log(`🌐 Ative o GitHub Pages em Settings → Pages → Branch: ${branch}`);
}

// Botão de clonagem
document.getElementById("cloneBtn").onclick = async () => {
  const siteUrl = document.getElementById("siteUrl").value.trim();
  const repo = document.getElementById("repo").value.trim();
  const token = document.getElementById("token").value.trim();
  const branch = document.getElementById("branch").value.trim() || "gh-pages";

  if (!siteUrl || !repo || !token) {
    alert("Preencha todos os campos!");
    return;
  }

  log("🔍 Iniciando clonagem...");
  const files = await fetchSite(siteUrl, 0, 0); // apenas homepage

  log("📤 Enviando para o GitHub...");
  await uploadToGitHub(repo, branch, token, files);

  log("🎉 Pronto! Ative o GitHub Pages para visualizar o site clonado.");
};
