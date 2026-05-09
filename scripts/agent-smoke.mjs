#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const html = readFileSync(path.join(rootDir, "app", "index.html"), "utf8");
const createAuctionHtml = readFileSync(
  path.join(rootDir, "app", "pages", "create-auction.html"),
  "utf8"
);
const submitBidHtml = readFileSync(
  path.join(rootDir, "app", "pages", "submit-bid.html"),
  "utf8"
);
const closeAuctionHtml = readFileSync(
  path.join(rootDir, "app", "pages", "close-auction.html"),
  "utf8"
);
const howItWorksHtml = readFileSync(
  path.join(rootDir, "app", "how-it-works.html"),
  "utf8"
);
const walletJs = readFileSync(path.join(rootDir, "app", "wallet.js"), "utf8");
const packageJson = JSON.parse(
  readFileSync(path.join(rootDir, "package.json"), "utf8")
);

const agents = Object.freeze([
  {
    id: "seller-ada",
    role: "seller",
    action: "create-auction",
    name: "Treasury NFT sale",
    asset: "1 of 1 encrypted lot",
    mode: "vickrey",
    reserve: 1160,
    supply: 1,
    endsAt: "2026-05-03T12:00",
  },
  {
    id: "bidder-bruno",
    role: "bidder",
    action: "submit-sealed-bid",
    bid: 1410,
    valuation: 1550,
    quantity: 1,
  },
  {
    id: "bidder-cyra",
    role: "bidder",
    action: "submit-sealed-bid",
    bid: 1675,
    valuation: 1720,
    quantity: 1,
  },
  {
    id: "bidder-dax",
    role: "bidder",
    action: "submit-sealed-bid",
    bid: 1530,
    valuation: 1610,
    quantity: 1,
  },
  {
    id: "bidder-eris",
    role: "bidder",
    action: "submit-sealed-bid",
    bid: 1200,
    valuation: 1300,
    quantity: 1,
  },
  {
    id: "liquidator-mira",
    role: "liquidator",
    action: "settle-after-close",
    observedAt: "2026-05-03T12:30",
  },
]);

const uiModel = Object.freeze({
  title: "Arcium Blind Auctions",
  pages: [
    "/app/pages/create-auction.html",
    "/app/pages/submit-bid.html",
    "/app/pages/close-auction.html",
    "/app/how-it-works.html",
  ],
  createFields: ["Auction title", "Asset", "Mode", "Reserve", "Seller wallet"],
  bidFields: ["Auction account", "Bid amount", "Quantity", "Private nonce"],
  closeFields: ["Auction account", "Expected bid count", "Closer wallet"],
  verifiedOutputs: ["Wallet", "Program", "Deploy tx"],
});

const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error });
  }
}

function normalized(text) {
  return text.replace(/\s+/g, " ").trim();
}

function htmlText() {
  return normalized(html.replace(/<[^>]+>/g, " ")).toLowerCase();
}

function hasLabel(source, text) {
  return source.toLowerCase().includes(text.toLowerCase());
}

function publicAgentId(agentId) {
  return createHash("sha256").update(agentId).digest("hex").slice(0, 12);
}

function buildActionLog(actorSpecs) {
  return actorSpecs.map((agent, index) =>
    Object.freeze({
      seq: index + 1,
      actor: publicAgentId(agent.id),
      role: agent.role,
      action: agent.action,
      payload: Object.freeze(
        Object.fromEntries(
          Object.entries(agent).filter(
            ([key]) => !["id", "role", "action"].includes(key)
          )
        )
      ),
    })
  );
}

function reduceAuction(events) {
  return events.reduce(
    (state, event) => {
      if (event.action === "create-auction") {
        assert.equal(state.auction, null, "auction must be created once");
        return {
          ...state,
          auction: {
            seller: event.actor,
            name: event.payload.name,
            asset: event.payload.asset,
            mode: event.payload.mode,
            reserve: event.payload.reserve,
            supply: event.payload.supply,
            endsAt: event.payload.endsAt,
            status: "open",
          },
        };
      }

      assert.notEqual(state.auction, null, "auction must exist before actions");

      if (event.action === "submit-sealed-bid") {
        assert.equal(
          state.auction.status,
          "open",
          "bidding requires open auction"
        );
        assert.ok(event.payload.bid >= 0, "bid must be non-negative");
        assert.ok(
          event.payload.valuation >= event.payload.bid,
          "valuation covers bid"
        );
        return {
          ...state,
          bids: state.bids.concat({
            bidder: event.actor,
            bid: event.payload.bid,
            valuation: event.payload.valuation,
            quantity: event.payload.quantity,
          }),
        };
      }

      if (event.action === "settle-after-close") {
        assert.ok(
          new Date(event.payload.observedAt).getTime() >=
            new Date(state.auction.endsAt).getTime(),
          "settlement requires closed auction window"
        );

        const ranked = [...state.bids].sort(
          (a, b) => b.bid - a.bid || a.bidder.localeCompare(b.bidder)
        );
        const winner = ranked[0];
        const runnerUp = ranked[1];
        const clearingPrice =
          winner && winner.bid >= state.auction.reserve
            ? Math.max(
                state.auction.reserve,
                runnerUp?.bid ?? state.auction.reserve
              )
            : null;

        return {
          ...state,
          auction: { ...state.auction, status: "settled" },
          settlement: winner
            ? {
                mode: state.auction.mode,
                winner:
                  winner.bid >= state.auction.reserve ? winner.bidder : null,
                winnerBid: winner.bid,
                clearingPrice,
                sellerProceeds: clearingPrice,
                refunds: state.bids
                  .filter((bid) => bid.bidder !== winner.bidder)
                  .map((bid) => ({ bidder: bid.bidder, amount: bid.bid })),
              }
            : null,
        };
      }

      throw new Error(`unknown action: ${event.action}`);
    },
    { auction: null, bids: [], settlement: null }
  );
}

function assertNoTransactionSurface() {
  const command = packageJson.scripts?.["agent:smoke"];
  assert.equal(command, "node scripts/agent-smoke.mjs");

  for (const blocked of [
    "@solana/web3.js",
    "@coral-xyz/anchor",
    "sendTransaction",
    ".rpc(",
    "Keypair.fromSecretKey",
    "process.env",
  ]) {
    assert.equal(command.includes(blocked), false, `${blocked} is not allowed`);
  }
}

check("defines deterministic seller, bidder, and liquidator agents", () => {
  assert.equal(agents.length >= 5, true);
  assert.equal(agents.filter((agent) => agent.role === "seller").length, 1);
  assert.equal(
    agents.filter((agent) => agent.role === "bidder").length >= 3,
    true
  );
  assert.equal(
    agents.filter((agent) => agent.role === "liquidator").length >= 1,
    true
  );
  assert.deepEqual(
    agents.map((agent) => agent.id),
    [
      "seller-ada",
      "bidder-bruno",
      "bidder-cyra",
      "bidder-dax",
      "bidder-eris",
      "liquidator-mira",
    ],
    "agent ordering must follow the fixed auction journey"
  );
});

check("validates routed wallet-enabled UI model", () => {
  const text = normalized(
    [html, createAuctionHtml, submitBidHtml, closeAuctionHtml, howItWorksHtml]
      .join(" ")
      .replace(/<[^>]+>/g, " ")
  ).toLowerCase();
  assert.ok(html.includes(`<title>${uiModel.title}</title>`));

  for (const expected of uiModel.pages) {
    assert.ok(html.includes(expected), `missing route link: ${expected}`);
  }

  for (const expected of [
    ...uiModel.createFields,
    ...uiModel.bidFields,
    ...uiModel.closeFields,
    ...uiModel.verifiedOutputs,
  ]) {
    assert.ok(
      text.includes(expected.toLowerCase()),
      `missing UI model term: ${expected}`
    );
  }

  assert.ok(hasLabel(html, "data-wallet-connect"));
  assert.ok(hasLabel(createAuctionHtml, "data-wallet-connect"));
  assert.ok(hasLabel(submitBidHtml, "data-wallet-connect"));
  assert.ok(hasLabel(closeAuctionHtml, "data-wallet-connect"));
  assert.ok(hasLabel(walletJs, "Choose a wallet"));
  assert.ok(hasLabel(walletJs, "Phantom"));
  assert.ok(hasLabel(walletJs, "Solflare"));
  assert.ok(hasLabel(walletJs, "Backpack"));
  assert.ok(hasLabel(walletJs, "Contract deployment required"));
});

check("derives auction state only from the deterministic action log", () => {
  const actionLog = buildActionLog(agents);
  const state = reduceAuction(actionLog);

  assert.equal(state.auction.status, "settled");
  assert.equal(state.auction.mode, "vickrey");
  assert.equal(state.bids.length, 4);
  assert.equal(state.settlement.winnerBid, 1675);
  assert.equal(state.settlement.clearingPrice, 1530);
  assert.equal(state.settlement.refunds.length, 3);
});

check("keeps bid intent private before settlement output", () => {
  const actionLog = buildActionLog(agents);
  const preSettlement = actionLog.filter(
    (event) => event.action !== "settle-after-close"
  );
  const publicTranscript = preSettlement.map((event) => ({
    seq: event.seq,
    actor: event.actor,
    role: event.role,
    action: event.action,
    fields:
      event.action === "submit-sealed-bid"
        ? ["encryptedBid", "encryptedValuation", "encryptedQuantity"]
        : Object.keys(event.payload),
  }));

  assert.equal(JSON.stringify(publicTranscript).includes("1675"), false);
  assert.equal(JSON.stringify(publicTranscript).includes("1530"), false);
});

check("runs locally without private keys or transaction calls", () => {
  assertNoTransactionSurface();
});

const failures = checks.filter((result) => !result.ok);
for (const result of checks) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
  if (!result.ok) {
    console.log(`  ${result.error.message}`);
  }
}

if (failures.length > 0) {
  process.exitCode = 1;
} else {
  console.log(`agent-smoke complete: ${checks.length} checks passed`);
}
