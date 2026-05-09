# Arcium Usage and Privacy Benefits

## Project

Arcium Blind Auctions is a Solana dapp for sealed-bid auction flows. The app separates public auction terms from private bidder intent so bidders can participate without exposing their bid strategy before settlement.

## How Arcium Is Used

The dapp is designed around Arcium confidential computation. Auction setup and wallet authorization happen on Solana, while sensitive bid values are treated as private inputs for Arcium-powered computation.

The intended Arcium flow is:

1. A seller creates public auction terms such as asset, payment mint, auction mode, reserve, supply, and close conditions.
2. A bidder prepares a sealed bid. The raw bid amount, quantity, and local nonce are not meant to be posted as readable on-chain state.
3. The frontend submits a wallet-signed Solana transaction that records an action receipt against the deployed Arcium program.
4. Confidential auction logic can evaluate encrypted bid commitments and reveal only the final result needed for settlement, such as winner and clearing price.

The deployed MVP includes a live Solana program instruction for wallet-signed action receipts. This gives every user action an explorer-verifiable on-chain footprint without publishing the private auction payload.

## Privacy Benefits

Normal on-chain auctions leak bid timing, bid amounts, bidder strategy, and auction demand before close. This creates opportunities for copy-bidding, collusion, and MEV extraction.

Using Arcium improves the design because:

- Bid amounts can remain confidential until the auction is finalized.
- Losing bid details do not need to become public auction state.
- Bidders cannot react to other bidders' private bids before close.
- The settlement result can be verified on-chain without exposing every private input.
- The auction can support sealed-bid, Vickrey, and uniform-price designs with reduced information leakage.

## Why This Matters

Blind auctions are useful when fair price discovery matters. Arcium enables auction logic that can compute over confidential bids instead of forcing every bidder to reveal strategy to the public ledger.
