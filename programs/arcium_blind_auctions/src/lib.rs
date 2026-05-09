pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
pub use constants::*;
pub use instructions::*;
#[allow(unused_imports)]
pub use state::*;

declare_id!("7yCwxegCFzv1JU47HQ6FKfMQqXBhVS3udi6GVjGN6Sq7");

#[arcium_program]
pub mod arcium_blind_auctions {
    use super::*;

    pub fn create_auction(
        ctx: Context<CreateAuction>,
        auction_id: u64,
        title: String,
        asset: String,
        mode: u8,
        reserve_price: u64,
        supply: u64,
        end_ts: i64,
    ) -> Result<()> {
        require!(title.len() <= Auction::MAX_TITLE, error::ErrorCode::CustomError);
        require!(asset.len() <= Auction::MAX_ASSET, error::ErrorCode::CustomError);
        require!(supply > 0, error::ErrorCode::CustomError);

        let auction = &mut ctx.accounts.auction;
        auction.seller = ctx.accounts.seller.key();
        auction.auction_id = auction_id;
        auction.title = title;
        auction.asset = asset;
        auction.mode = mode;
        auction.reserve_price = reserve_price;
        auction.supply = supply;
        auction.end_ts = end_ts;
        auction.bid_count = 0;
        auction.status = 1;
        auction.bump = ctx.bumps.auction;
        Ok(())
    }

    pub fn submit_bid_receipt(
        ctx: Context<SubmitBidReceipt>,
        bid_id: u64,
        encrypted_bid_hash: [u8; 32],
        quantity: u64,
    ) -> Result<()> {
        require!(quantity > 0, error::ErrorCode::CustomError);

        let receipt = &mut ctx.accounts.bid_receipt;
        receipt.auction = ctx.accounts.auction.key();
        receipt.bidder = ctx.accounts.bidder.key();
        receipt.bid_id = bid_id;
        receipt.encrypted_bid_hash = encrypted_bid_hash;
        receipt.quantity = quantity;
        receipt.bump = ctx.bumps.bid_receipt;

        ctx.accounts.auction.bid_count = ctx.accounts.auction.bid_count.saturating_add(1);
        Ok(())
    }

    pub fn record_action(
        ctx: Context<RecordAction>,
        action_id: u64,
        action_type: u8,
        payload_hash: [u8; 32],
    ) -> Result<()> {
        let receipt = &mut ctx.accounts.action_receipt;
        receipt.actor = ctx.accounts.actor.key();
        receipt.action_id = action_id;
        receipt.action_type = action_type;
        receipt.payload_hash = payload_hash;
        receipt.created_ts = Clock::get()?.unix_timestamp;
        receipt.bump = ctx.bumps.action_receipt;
        Ok(())
    }

    pub fn init_add_together_comp_def(ctx: Context<InitAddTogetherCompDef>) -> Result<()> {
        add_together::init_add_together_comp_def_handler(ctx)
    }

    pub fn add_together(
        ctx: Context<AddTogether>,
        computation_offset: u64,
        ciphertext_0: [u8; 32],
        ciphertext_1: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        add_together::add_together_handler(ctx, computation_offset, ciphertext_0, ciphertext_1, pub_key, nonce)
    }

    #[arcium_callback(encrypted_ix = "add_together")]
    pub fn add_together_callback(
        ctx: Context<AddTogetherCallback>,
        output: SignedComputationOutputs<AddTogetherOutput>,
    ) -> Result<()> {
        add_together::add_together_callback_handler(ctx, output)
    }
}

#[derive(Accounts)]
#[instruction(auction_id: u64)]
pub struct CreateAuction<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        init,
        payer = seller,
        space = Auction::SPACE,
        seeds = [b"auction", seller.key().as_ref(), &auction_id.to_le_bytes()],
        bump
    )]
    pub auction: Account<'info, Auction>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(bid_id: u64)]
pub struct SubmitBidReceipt<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,
    #[account(mut)]
    pub auction: Account<'info, Auction>,
    #[account(
        init,
        payer = bidder,
        space = BidReceipt::SPACE,
        seeds = [b"bid", auction.key().as_ref(), bidder.key().as_ref(), &bid_id.to_le_bytes()],
        bump
    )]
    pub bid_receipt: Account<'info, BidReceipt>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(action_id: u64)]
pub struct RecordAction<'info> {
    #[account(mut)]
    pub actor: Signer<'info>,
    #[account(
        init,
        payer = actor,
        space = ActionReceipt::SPACE,
        seeds = [b"action", actor.key().as_ref(), &action_id.to_le_bytes()],
        bump
    )]
    pub action_receipt: Account<'info, ActionReceipt>,
    pub system_program: Program<'info, System>,
}
