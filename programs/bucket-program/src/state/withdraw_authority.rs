use anchor_lang::prelude::*;

#[account]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct WithdrawAuthority {
    pub bump: u8,
}

impl WithdrawAuthority {
    pub fn init(&mut self, bump: u8) {
        self.bump = bump;
    }
}
