# Arcium Blind Auctions

Sealed-bid auction dapp for Solana and Arcium. The app gives sellers separate pages to create auction terms, bidders a page to submit confidential bids, and closers a page to request settlement.

## Live Status

- Network: Solana devnet
- Program: `7yCwxegCFzv1JU47HQ6FKfMQqXBhVS3udi6GVjGN6Sq7`
- Frontend: https://arciumblindauctions.vercel.app

## Fuller Dapp Flow

1. Connect a Solana wallet.
2. Create auction terms.
3. Submit sealed bids from bidder wallets.
4. Close the auction after the bidding window.
5. Review the private workspace for local bid drafts and explorer-confirmed receipts.

Every form sends a real wallet-signed transaction to the deployed program. The UI keeps the private draft in browser local storage and links it to the transaction signature so the user can verify the action on Solana Explorer without exposing private bid data.

## How Arcium Is Used

Arcium is the confidential-computation layer for evaluating private auction inputs. The design keeps public auction terms on Solana while treating bid values, bidder strategy, and nonce data as private inputs for Arcium-style computation.

The MVP program records explorer-verifiable action receipts. The privacy layer is structured so future Arcium computation can evaluate sealed-bid, Vickrey, or uniform-price settlement without publishing every bid.

## Privacy Benefits

- Bid amounts do not need to be readable public state.
- Bidders cannot copy or react to other bidders' private values before close.
- Losing bid details can remain private.
- Settlement can reveal only the winner and required clearing value.

## Local Versus On-Chain Data

The transaction receipt is on-chain. The raw bid draft shown in the private workspace is local to the browser and wallet. Clearing browser storage removes the local draft but does not remove the Solana transaction.

## Commands

```bash
yarn install
arcium build
arcium test
```
