const logBox = document.getElementById("log");
function log(msg) {
  console.log(msg);
  logBox.value += msg + "\n";
  logBox.scrollTop = logBox.scrollHeight;
}

document.getElementById("cloneBtn").onclick = async () => {
  const siteUrl = document.getElementById("siteUrl").value.trim();
  const repo = document.getElementById("repo").value.trim();
  const token = document.getElementById("token").value.trim();
  const branch = document.getElementById("branch").value.trim();
  const depth = parseInt(document.getElementById("depth").value) || 1;

  if (!siteUrl || !repo || !token) {
    alert("Preencha todos os campos!");
    return;
  }

  log("🔍 Iniciando clonagem...");
  try {
    const res = await fetch("/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteUrl, repo, token, branch, depth })
    });
    const data = await res.json();
    log(data.message);
  } catch (err) {
    log(`❌ Erro: ${err.message}`);
  }
};
