use anchor_lang::prelude::*;

#[account]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct IssueAuthority {
    pub bump: u8,
}

impl IssueAuthority {
    pub fn init(&mut self, bump: u8) {
        self.bump = bump;
    }
}
