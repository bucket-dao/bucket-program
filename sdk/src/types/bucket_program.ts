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
      "name": "ErrorCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "WrongCollateralError"
          },
          {
            "name": "CollateralAlreadyAuthorizedError"
          },
          {
            "name": "WrongBurnError"
          },
          {
            "name": "CollateralSizeLimitsExceeded"
          },
          {
            "name": "AllocationBpsExceeded"
          },
          {
            "name": "NumericalOverflowError"
          },
          {
            "name": "NumericalUnderflowError"
          },
          {
            "name": "NumericalDivisionError"
          }
        ]
      }
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
      "name": "ErrorCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "WrongCollateralError"
          },
          {
            "name": "CollateralAlreadyAuthorizedError"
          },
          {
            "name": "WrongBurnError"
          },
          {
            "name": "CollateralSizeLimitsExceeded"
          },
          {
            "name": "AllocationBpsExceeded"
          },
          {
            "name": "NumericalOverflowError"
          },
          {
            "name": "NumericalUnderflowError"
          },
          {
            "name": "NumericalDivisionError"
          }
        ]
      }
    }
  ]
};
