use anchor_lang::prelude::*;

#[account]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct IssueAuthority {
    /// Bump.
    pub bump: u8,
}

#[account]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct WithdrawAuthority {
    /// Bump.
    pub bump: u8,
}

impl IssueAuthority {
    pub fn init(&mut self, bump: u8) {
        self.bump = bump;
    }
}

impl WithdrawAuthority {
    pub fn init(&mut self, bump: u8) {
        self.bump = bump;
    }
}
