# Arcium Blind Auctions

An Arcium RTG developer submission for sealed-bid auctions on Solana.

## What It Builds
This repo contains an Arcium/Anchor project for encrypted auction computation. Bidders encrypt bid values client-side; the Solana program queues an Arcium computation; Arcium nodes compute the auction result over encrypted shares; the callback reveals only the winner and settlement value needed for escrow settlement.

The current generated circuit is the buildable Arcium integration base. The auction domain layer is documented in `PRIVACY.md`, `DEPLOYMENT.md`, and the Vercel demo in `app/`.

## Privacy Benefit
Blind auctions stop bidders, searchers, and market makers from reacting to live bid values before the auction closes. This reduces collusion, MEV leakage, and copy-bidding.

## Arcium Flow
1. Client derives an x25519 shared secret with the MXE public key.
2. Client encrypts bid inputs with `@arcium-hq/client`.
3. Program queues the encrypted computation.
4. Arcium finalizes the computation.
5. Callback verifies signed output and emits the final settlement event.

## Commands

```bash
yarn install
arcium build
arcium test
```

## RTG Notes
- Functional Solana/Arcium project scaffolded with `arcium init`.
- Open-source repo ready.
- English explanation included.
- Frontend demo included under `app/`.
