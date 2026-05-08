const short = (value) =>
  value ? `${value.slice(0, 6)}...${value.slice(-6)}` : "Not connected";

async function loadDeployment() {
  try {
    const response = await fetch("/app/deployment.json", { cache: "no-store" });
    if (!response.ok) throw new Error("missing deployment metadata");
    return await response.json();
  } catch {
    return null;
  }
}

function explorerAddress(address, cluster = "devnet") {
  return `https://explorer.solana.com/address/${address}?cluster=${cluster}`;
}

function explorerTx(signature, cluster = "devnet") {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

async function verifyProgram(programId, cluster = "devnet") {
  if (!programId) return { ok: false, reason: "No program id" };
  const endpoint =
    cluster === "mainnet-beta"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getAccountInfo",
    params: [programId, { encoding: "base64" }],
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return {
    ok: Boolean(json.result?.value),
    owner: json.result?.value?.owner || "",
    lamports: json.result?.value?.lamports || 0,
  };
}

async function connectWallet() {
  const provider = window.solana;
  if (!provider?.isPhantom && !provider?.connect) {
    alert(
      "Install Phantom or another Solana wallet that injects window.solana."
    );
    return;
  }
  const result = await provider.connect();
  const pubkey = result.publicKey?.toString() || provider.publicKey?.toString();
  document.querySelectorAll("[data-wallet-address]").forEach((node) => {
    node.textContent = short(pubkey);
    node.title = pubkey;
  });
  document.querySelectorAll("[data-wallet-full]").forEach((node) => {
    node.textContent = pubkey || "Not connected";
  });
  document.querySelectorAll("[data-wallet-state]").forEach((node) => {
    node.textContent = "Wallet connected";
    node.classList.add("verified");
  });
}

async function hydrateDeployment() {
  const deployment = await loadDeployment();
  const statusNodes = document.querySelectorAll("[data-deployment-status]");
  const programNodes = document.querySelectorAll("[data-program-id]");
  const txNodes = document.querySelectorAll("[data-deploy-tx]");
  if (!deployment) {
    statusNodes.forEach((node) => {
      node.textContent = "No verified contract metadata";
      node.classList.add("warning");
    });
    return;
  }
  statusNodes.forEach((node) => {
    node.textContent = `Deployed on ${deployment.cluster}`;
    node.classList.add("verified");
  });
  programNodes.forEach((node) => {
    node.innerHTML = `<a href="${explorerAddress(
      deployment.programId,
      deployment.cluster
    )}" target="_blank" rel="noreferrer">${deployment.programId}</a>`;
  });
  txNodes.forEach((node) => {
    node.innerHTML = `<a href="${explorerTx(
      deployment.programDeploySignature,
      deployment.cluster
    )}" target="_blank" rel="noreferrer">${short(
      deployment.programDeploySignature
    )}</a>`;
  });
  const verifyNodes = document.querySelectorAll("[data-program-verified]");
  if (verifyNodes.length) {
    try {
      const result = await verifyProgram(
        deployment.programId,
        deployment.cluster
      );
      verifyNodes.forEach((node) => {
        node.textContent = result.ok
          ? `Explorer verified. Owner: ${short(result.owner)}. Lamports: ${
              result.lamports
            }`
          : "Program account was not found by RPC.";
        node.classList.toggle("verified", result.ok);
      });
    } catch {
      verifyNodes.forEach((node) => {
        node.textContent =
          "RPC verification was rate-limited. Use the explorer link.";
        node.classList.add("warning");
      });
    }
  }
}

document
  .querySelectorAll("[data-wallet-connect]")
  .forEach((button) => button.addEventListener("click", connectWallet));
hydrateDeployment();
