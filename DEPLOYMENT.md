# Deployment

## Local

```bash
yarn install
arcium build
arcium test
```

## Devnet

```bash
solana config set --url devnet --keypair ~/.config/solana/arcium-rtg-deployer.json
solana airdrop 2
arcium build
arcium deploy --cluster-offset 456 --recovery-set-size 4 --rpc-url https://api.devnet.solana.com
arcium test --cluster devnet --offset 456
```

## Submission Checklist
- Confirm the program id in `Anchor.toml`.
- Upload the GitHub repo URL.
- Link the Vercel demo URL.
- Explain that bids are encrypted until the auction closes.
