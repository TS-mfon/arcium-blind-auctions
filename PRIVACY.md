# Privacy Model

## Private
- Bid amount before close.
- Bidder valuation and max quantity.
- Losing bid values.
- Uniform-auction demand curve before finalization.

## Public
- Auction metadata, escrowed asset, start and end time.
- Bidder count and auction mode.
- Final winner set and settlement price.
- Claim, refund, and seller-withdraw transactions.

## Arcium Role
Arcium computes over encrypted bid inputs using MPC. The Solana program only receives a verified callback result, so bidders cannot react to live competing bid values and searchers cannot extract bid intent before close.
