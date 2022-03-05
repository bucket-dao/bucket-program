pub const MAX_BASIS_POINTS: u16 = 10000;

/// based on current PDA attributes, max collateral elements is approx 315.
/// beyond this, we risk exceeding the 10MB account size limitation.
pub const MAX_COLLATERAL_ELEMENTS: usize = 315;

/// PDA seed strings
pub const BUCKET_SEED: &str = "bucket";
pub const ISSUE_SEED: &str = "issue";
pub const WITHDRAW_SEED: &str = "withdraw";
