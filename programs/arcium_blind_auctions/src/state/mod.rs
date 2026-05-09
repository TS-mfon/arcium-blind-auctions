use anchor_lang::prelude::*;

#[account]
pub struct Auction {
    pub seller: Pubkey,
    pub auction_id: u64,
    pub title: String,
    pub asset: String,
    pub mode: u8,
    pub reserve_price: u64,
    pub supply: u64,
    pub end_ts: i64,
    pub bid_count: u32,
    pub status: u8,
    pub bump: u8,
}

impl Auction {
    pub const MAX_TITLE: usize = 64;
    pub const MAX_ASSET: usize = 64;
    pub const SPACE: usize = 8
        + 32
        + 8
        + 4
        + Self::MAX_TITLE
        + 4
        + Self::MAX_ASSET
        + 1
        + 8
        + 8
        + 8
        + 4
        + 1
        + 1;
}

#[account]
pub struct BidReceipt {
    pub auction: Pubkey,
    pub bidder: Pubkey,
    pub bid_id: u64,
    pub encrypted_bid_hash: [u8; 32],
    pub quantity: u64,
    pub bump: u8,
}

impl BidReceipt {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 32 + 8 + 1;
}

#[account]
pub struct ActionReceipt {
    pub actor: Pubkey,
    pub action_id: u64,
    pub action_type: u8,
    pub payload_hash: [u8; 32],
    pub created_ts: i64,
    pub bump: u8,
}

impl ActionReceipt {
    pub const SPACE: usize = 8 + 32 + 8 + 1 + 32 + 8 + 1;
}
