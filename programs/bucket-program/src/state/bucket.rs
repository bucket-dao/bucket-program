use anchor_lang::prelude::*;

/// 🪣
///
/// Lets users print $BUCKET or redeem $BUCKET for its underlying.
#[account]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Bucket {
    // bump
}