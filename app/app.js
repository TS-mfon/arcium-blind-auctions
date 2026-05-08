const state = {
  auction: null,
  bids: [],
  closed: false,
};

const elements = {
  auctionForm: document.querySelector("#auction-form"),
  bidForm: document.querySelector("#bid-form"),
  resetAuction: document.querySelector("#reset-auction"),
  closeAuction: document.querySelector("#close-auction"),
  status: document.querySelector("#auction-status"),
  bidCount: document.querySelector("#bid-count"),
  bidTable: document.querySelector("#bid-table"),
  resultBox: document.querySelector("#result-box"),
  deploymentState: document.querySelector("#deployment-state"),
  deploymentDot: document.querySelector("#deployment-dot"),
  stateName: document.querySelector("#state-name"),
  stateMode: document.querySelector("#state-mode"),
  stateReserve: document.querySelector("#state-reserve"),
  stateSupply: document.querySelector("#state-supply"),
  stateEnd: document.querySelector("#state-end"),
  endInput: document.querySelector("#auction-end"),
};

function setDefaultEndTime() {
  const end = new Date(Date.now() + 60 * 60 * 1000);
  end.setMinutes(end.getMinutes() - end.getTimezoneOffset());
  elements.endInput.value = end.toISOString().slice(0, 16);
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function titleForMode(mode) {
  return {
    "first-price": "First-price sealed bid",
    vickrey: "Vickrey second price",
    uniform: "Uniform price, fixed supply",
  }[mode];
}

async function sha256(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function readAuctionForm(form) {
  const data = new FormData(form);
  return {
    name: data.get("auctionName").trim(),
    asset: data.get("auctionAsset").trim(),
    mode: data.get("auctionMode"),
    supply: Number.parseInt(data.get("auctionSupply"), 10),
    reserve: Number.parseFloat(data.get("reservePrice")),
    endsAt: data.get("auctionEnd"),
  };
}

function readBidForm(form) {
  const data = new FormData(form);
  return {
    bidder: data.get("bidderName").trim(),
    bidderKey: data.get("bidderKey").trim(),
    amount: Number.parseFloat(data.get("bidAmount")),
    quantity: Number.parseInt(data.get("bidQuantity"), 10),
    nonce: data.get("bidNonce").trim(),
  };
}

function validateAuction(auction) {
  if (!auction.name || !auction.asset)
    return "Auction name and asset are required.";
  if (!Number.isFinite(auction.supply) || auction.supply < 1)
    return "Supply must be at least 1.";
  if (!Number.isFinite(auction.reserve) || auction.reserve < 0)
    return "Reserve price cannot be negative.";
  if (!auction.endsAt || Number.isNaN(new Date(auction.endsAt).getTime()))
    return "Choose a valid end time.";
  return "";
}

function validateBid(bid) {
  if (!state.auction || state.closed)
    return "Open an active auction before sealing a bid.";
  if (!bid.bidder || !bid.bidderKey || !bid.nonce)
    return "Bidder, public key, and nonce are required.";
  if (!Number.isFinite(bid.amount) || bid.amount < 0)
    return "Bid amount cannot be negative.";
  if (!Number.isFinite(bid.quantity) || bid.quantity < 1)
    return "Quantity must be at least 1.";
  return "";
}

function settleAuction() {
  if (!state.auction || !state.closed) return null;

  const eligible = state.bids
    .filter((bid) => bid.amount >= state.auction.reserve)
    .sort((a, b) => b.amount - a.amount || a.createdAt - b.createdAt);

  if (!eligible.length) {
    return {
      winners: [],
      clearingPrice: 0,
      message: "No bid met the reserve.",
    };
  }

  if (state.auction.mode === "vickrey") {
    const winner = eligible[0];
    const second = eligible[1];
    return {
      winners: [{ ...winner, awarded: 1 }],
      clearingPrice: second
        ? Math.max(second.amount, state.auction.reserve)
        : state.auction.reserve,
      message:
        "Highest bidder wins and pays the second-highest eligible price.",
    };
  }

  if (state.auction.mode === "uniform") {
    let remaining = state.auction.supply;
    const winners = [];

    for (const bid of eligible) {
      if (remaining <= 0) break;
      const awarded = Math.min(bid.quantity, remaining);
      winners.push({ ...bid, awarded });
      remaining -= awarded;
    }

    const lastWinner = winners[winners.length - 1];
    return {
      winners,
      clearingPrice: lastWinner
        ? Math.max(lastWinner.amount, state.auction.reserve)
        : 0,
      message: "Eligible bids fill supply from highest price down.",
    };
  }

  return {
    winners: [{ ...eligible[0], awarded: 1 }],
    clearingPrice: eligible[0].amount,
    message: "Highest eligible bidder wins and pays their bid.",
  };
}

function renderState() {
  const auction = state.auction;
  elements.status.textContent = !auction
    ? "No auction"
    : state.closed
    ? "Closed"
    : "Bidding open";
  elements.closeAuction.disabled = !auction || state.closed;
  elements.bidCount.textContent = `${state.bids.length} ${
    state.bids.length === 1 ? "bid" : "bids"
  }`;

  elements.stateName.textContent = auction
    ? `${auction.name} - ${auction.asset}`
    : "Not created";
  elements.stateMode.textContent = auction ? titleForMode(auction.mode) : "-";
  elements.stateReserve.textContent = auction
    ? formatCurrency(auction.reserve)
    : "-";
  elements.stateSupply.textContent = auction ? String(auction.supply) : "-";
  elements.stateEnd.textContent = auction ? formatDate(auction.endsAt) : "-";

  renderBids();
  renderResult();
}

function renderBids() {
  if (!state.bids.length) {
    elements.bidTable.innerHTML =
      '<tr><td colspan="5" class="empty-row">No sealed bids yet.</td></tr>';
    return;
  }

  elements.bidTable.innerHTML = state.bids
    .map((bid) => {
      const shortKey = `${bid.bidderKey.slice(0, 8)}...${bid.bidderKey.slice(
        -6
      )}`;
      const commitment = `${bid.commitment.slice(
        0,
        18
      )}...${bid.commitment.slice(-10)}`;
      return `
        <tr>
          <td>${escapeHtml(bid.bidder)}</td>
          <td title="${escapeHtml(bid.bidderKey)}">${escapeHtml(shortKey)}</td>
          <td>${bid.quantity}</td>
          <td title="${bid.commitment}">${commitment}</td>
          <td><span class="chip ${state.closed ? "" : "pending"}">${
        state.closed ? "revealed" : "sealed"
      }</span></td>
        </tr>
      `;
    })
    .join("");
}

function renderResult() {
  if (!state.auction) {
    elements.resultBox.innerHTML =
      '<p class="muted">Create an auction and submit bids to preview the settlement result.</p>';
    return;
  }

  if (!state.closed) {
    elements.resultBox.innerHTML = `
      <p><strong>${escapeHtml(state.auction.name)}</strong></p>
      <p class="muted">Bidding is open. The local settlement preview unlocks after close.</p>
    `;
    return;
  }

  const result = settleAuction();
  if (!result.winners.length) {
    elements.resultBox.innerHTML = `<p><strong>No winner</strong></p><p class="muted">${result.message}</p>`;
    return;
  }

  const winners = result.winners
    .map((winner) => `${escapeHtml(winner.bidder)} x ${winner.awarded}`)
    .join(", ");

  elements.resultBox.innerHTML = `
    <p><strong>${winners}</strong></p>
    <p>Clearing price: ${formatCurrency(result.clearingPrice)}</p>
    <p class="muted">${result.message}</p>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char];
  });
}

function normalizeDeployment(raw) {
  const programId =
    raw.programId || raw.program_id || raw.programID || raw.address;
  const deployer =
    raw.deployer || raw.deployerAddress || raw.authority || raw.wallet;
  const network = raw.network || raw.cluster || raw.solanaCluster || "devnet";
  const declaredSignatures =
    raw.transactionSignatures ||
    raw.signatures ||
    raw.transactions ||
    raw.txSignatures ||
    [];
  const namedSignatures = Object.entries(raw)
    .filter(([key, value]) => /signature/i.test(key) && value)
    .flatMap(([, value]) => asArray(value));
  const explorerLinks = raw.explorerLinks || raw.explorers || raw.links || [];

  return {
    programId,
    deployer,
    network,
    explorerBase: raw.explorerBase,
    signatures: unique(
      [...asArray(declaredSignatures), ...namedSignatures].filter(Boolean)
    ),
    explorerLinks: asArray(explorerLinks),
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

function unique(values) {
  return [...new Set(values)];
}

function explorerUrl(
  signature,
  network,
  explorerBase = "https://explorer.solana.com"
) {
  if (/^https?:\/\//i.test(signature)) return signature;
  const cluster =
    network === "mainnet-beta" || network === "mainnet"
      ? ""
      : `?cluster=${encodeURIComponent(network)}`;
  return `${explorerBase.replace(/\/$/, "")}/tx/${encodeURIComponent(
    signature
  )}${cluster}`;
}

async function loadDeployment() {
  try {
    const response = await fetch("./deployment.json", { cache: "no-store" });
    if (!response.ok) throw new Error("missing");
    const deployment = normalizeDeployment(await response.json());

    elements.deploymentDot.classList.add("verified");
    elements.deploymentState.innerHTML = `
      <dl class="deployment-list">
        <div>
          <dt>Program id</dt>
          <dd>${
            deployment.programId
              ? escapeHtml(deployment.programId)
              : "Not provided"
          }</dd>
        </div>
        <div>
          <dt>Deployer</dt>
          <dd>${
            deployment.deployer
              ? escapeHtml(deployment.deployer)
              : "Not provided"
          }</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>${escapeHtml(deployment.network)}</dd>
        </div>
        <div>
          <dt>Transaction signatures</dt>
          <dd>${renderSignatureLinks(
            deployment.signatures,
            deployment.network,
            deployment.explorerBase
          )}</dd>
        </div>
        <div>
          <dt>Explorer links</dt>
          <dd>${renderExplorerLinks(deployment.explorerLinks, deployment)}</dd>
        </div>
      </dl>
    `;
  } catch {
    elements.deploymentDot.classList.add("missing");
    elements.deploymentState.innerHTML =
      '<p class="muted">No app/deployment.json was found. Add one with programId, deployer, transactionSignatures, and explorerLinks to populate this panel.</p>';
  }
}

function renderSignatureLinks(signatures, network, explorerBase) {
  const filtered = signatures.filter(Boolean);
  if (!filtered.length) return "Not provided";
  return filtered
    .map((signature) => {
      const label = /^https?:\/\//i.test(signature)
        ? signature
        : `${signature.slice(0, 12)}...${signature.slice(-10)}`;
      return `<a href="${escapeHtml(
        explorerUrl(signature, network, explorerBase)
      )}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
    })
    .join("<br />");
}

function renderExplorerLinks(links, deployment) {
  const base = deployment.explorerBase || "https://explorer.solana.com";
  const cluster =
    deployment.network === "mainnet-beta" || deployment.network === "mainnet"
      ? ""
      : `?cluster=${encodeURIComponent(deployment.network)}`;
  const synthesized = deployment.programId
    ? [
        `${base.replace(/\/$/, "")}/address/${encodeURIComponent(
          deployment.programId
        )}${cluster}`,
      ]
    : [];
  const filtered = unique([...links, ...synthesized].filter(Boolean));
  if (!filtered.length) return "Not provided";
  return filtered
    .map(
      (link) =>
        `<a href="${escapeHtml(
          link
        )}" target="_blank" rel="noreferrer">${escapeHtml(link)}</a>`
    )
    .join("<br />");
}

elements.auctionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const auction = readAuctionForm(event.currentTarget);
  const error = validateAuction(auction);
  if (error) {
    alert(error);
    return;
  }

  state.auction = auction;
  state.bids = [];
  state.closed = false;
  renderState();
});

elements.bidForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const bid = readBidForm(event.currentTarget);
  const error = validateBid(bid);
  if (error) {
    alert(error);
    return;
  }

  const commitment = await sha256(
    JSON.stringify({
      auction: state.auction.name,
      bidderKey: bid.bidderKey,
      amount: bid.amount,
      quantity: bid.quantity,
      nonce: bid.nonce,
    })
  );

  state.bids.push({
    ...bid,
    commitment,
    createdAt: Date.now(),
  });

  event.currentTarget.reset();
  document.querySelector("#bid-quantity").value = "1";
  renderState();
});

elements.closeAuction.addEventListener("click", () => {
  state.closed = true;
  renderState();
});

elements.resetAuction.addEventListener("click", () => {
  state.auction = null;
  state.bids = [];
  state.closed = false;
  elements.auctionForm.reset();
  document.querySelector("#auction-supply").value = "1";
  document.querySelector("#reserve-price").value = "0";
  setDefaultEndTime();
  renderState();
});

setDefaultEndTime();
renderState();
loadDeployment();
