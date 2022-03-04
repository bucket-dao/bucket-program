export type BucketProgram = {
  "version": "0.1.0",
  "name": "bucket_program",
  "instructions": [
    {
      "name": "createBucket",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "bucket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "issueAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "withdrawAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rebalanceAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "crateMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "crateToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "crateTokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bucketBump",
          "type": "u8"
        },
        {
          "name": "crateBump",
          "type": "u8"
        },
        {
          "name": "issueAuthorityBump",
          "type": "u8"
        },
        {
          "name": "withdrawAuthorityBump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "updateRebalanceAuthority",
      "accounts": [
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "bucket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "crateToken",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "rebalanceAuthority",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "authorizeCollateral",
      "accounts": [
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "bucket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "crateToken",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "mint",
          "type": "publicKey"
        },
        {
          "name": "allocation",
          "type": "u16"
        }
      ]
    },
    {
      "name": "setCollateralAllocations",
      "accounts": [
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "bucket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "crateToken",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "allocations",
          "type": {
            "vec": {
              "defined": "Collateral"
            }
          }
        }
      ]
    },
    {
      "name": "deposit",
      "accounts": [
        {
          "name": "depositor",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "common",
          "accounts": [
            {
              "name": "bucket",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "crateToken",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "crateMint",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "crateTokenProgram",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "systemProgram",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "tokenProgram",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "issueAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "crateCollateral",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "collateralMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "depositorCollateral",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "depositorReserve",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "oracle",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "depositAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "redeem",
      "accounts": [
        {
          "name": "withdrawer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "common",
          "accounts": [
            {
              "name": "bucket",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "crateToken",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "crateMint",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "crateTokenProgram",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "systemProgram",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "tokenProgram",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "withdrawAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "withdrawerReserve",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "oracle",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "withdrawAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bucket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "crateMint",
            "type": "publicKey"
          },
          {
            "name": "crateToken",
            "type": "publicKey"
          },
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "rebalanceAuthority",
            "type": "publicKey"
          },
          {
            "name": "collateral",
            "type": {
              "vec": {
                "defined": "Collateral"
              }
            }
          }
        ]
      }
    },
    {
      "name": "issueAuthority",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "withdrawAuthority",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Collateral",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "allocation",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "PriceStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Unknown"
          },
          {
            "name": "Trading"
          },
          {
            "name": "Halted"
          },
          {
            "name": "Auction"
          }
        ]
      }
    },
    {
      "name": "CorpAction",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "NoCorpAct"
          }
        ]
      }
    },
    {
      "name": "PriceType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Unknown"
          },
          {
            "name": "Price"
          },
          {
            "name": "TWAP"
          },
          {
            "name": "Volatility"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "WrongBurnError",
      "msg": "Must burn reserve token"
    },
    {
      "code": 6001,
      "name": "AllocationBpsExceeded",
      "msg": "Max allocation bps exceeded"
    },
    {
      "code": 6002,
      "name": "WrongCollateralError",
      "msg": "Must deposit an approved collateral mint"
    },
    {
      "code": 6003,
      "name": "CollateralAlreadyAuthorizedError",
      "msg": "Cannot re-authorized a collateral mint authorized"
    },
    {
      "code": 6004,
      "name": "CollateralSizeLimitsExceeded",
      "msg": "Collateral size limits exceeded"
    },
    {
      "code": 6005,
      "name": "NumericalUnderflowError",
      "msg": "Numerical Underflow Error"
    },
    {
      "code": 6006,
      "name": "NumericalOverflowError",
      "msg": "Numerical Overflow Error"
    },
    {
      "code": 6007,
      "name": "NumericalDivisionError",
      "msg": "Numerical Division Error"
    }
  ]
};

export const IDL: BucketProgram = {
  "version": "0.1.0",
  "name": "bucket_program",
  "instructions": [
    {
      "name": "createBucket",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "bucket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "issueAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "withdrawAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rebalanceAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "crateMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "crateToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "crateTokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bucketBump",
          "type": "u8"
        },
        {
          "name": "crateBump",
          "type": "u8"
        },
        {
          "name": "issueAuthorityBump",
          "type": "u8"
        },
        {
          "name": "withdrawAuthorityBump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "updateRebalanceAuthority",
      "accounts": [
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "bucket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "crateToken",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "rebalanceAuthority",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "authorizeCollateral",
      "accounts": [
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "bucket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "crateToken",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "mint",
          "type": "publicKey"
        },
        {
          "name": "allocation",
          "type": "u16"
        }
      ]
    },
    {
      "name": "setCollateralAllocations",
      "accounts": [
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "bucket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "crateToken",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "allocations",
          "type": {
            "vec": {
              "defined": "Collateral"
            }
          }
        }
      ]
    },
    {
      "name": "deposit",
      "accounts": [
        {
          "name": "depositor",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "common",
          "accounts": [
            {
              "name": "bucket",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "crateToken",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "crateMint",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "crateTokenProgram",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "systemProgram",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "tokenProgram",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "issueAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "crateCollateral",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "collateralMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "depositorCollateral",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "depositorReserve",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "oracle",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "depositAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "redeem",
      "accounts": [
        {
          "name": "withdrawer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "common",
          "accounts": [
            {
              "name": "bucket",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "crateToken",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "crateMint",
              "isMut": true,
              "isSigner": false
            },
            {
              "name": "crateTokenProgram",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "systemProgram",
              "isMut": false,
              "isSigner": false
            },
            {
              "name": "tokenProgram",
              "isMut": false,
              "isSigner": false
            }
          ]
        },
        {
          "name": "withdrawAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "withdrawerReserve",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "oracle",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "withdrawAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bucket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "crateMint",
            "type": "publicKey"
          },
          {
            "name": "crateToken",
            "type": "publicKey"
          },
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "rebalanceAuthority",
            "type": "publicKey"
          },
          {
            "name": "collateral",
            "type": {
              "vec": {
                "defined": "Collateral"
              }
            }
          }
        ]
      }
    },
    {
      "name": "issueAuthority",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "withdrawAuthority",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Collateral",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "allocation",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "PriceStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Unknown"
          },
          {
            "name": "Trading"
          },
          {
            "name": "Halted"
          },
          {
            "name": "Auction"
          }
        ]
      }
    },
    {
      "name": "CorpAction",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "NoCorpAct"
          }
        ]
      }
    },
    {
      "name": "PriceType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Unknown"
          },
          {
            "name": "Price"
          },
          {
            "name": "TWAP"
          },
          {
            "name": "Volatility"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "WrongBurnError",
      "msg": "Must burn reserve token"
    },
    {
      "code": 6001,
      "name": "AllocationBpsExceeded",
      "msg": "Max allocation bps exceeded"
    },
    {
      "code": 6002,
      "name": "WrongCollateralError",
      "msg": "Must deposit an approved collateral mint"
    },
    {
      "code": 6003,
      "name": "CollateralAlreadyAuthorizedError",
      "msg": "Cannot re-authorized a collateral mint authorized"
    },
    {
      "code": 6004,
      "name": "CollateralSizeLimitsExceeded",
      "msg": "Collateral size limits exceeded"
    },
    {
      "code": 6005,
      "name": "NumericalUnderflowError",
      "msg": "Numerical Underflow Error"
    },
    {
      "code": 6006,
      "name": "NumericalOverflowError",
      "msg": "Numerical Overflow Error"
    },
    {
      "code": 6007,
      "name": "NumericalDivisionError",
      "msg": "Numerical Division Error"
    }
  ]
};
