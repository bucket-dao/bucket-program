export type BucketProgram = {
  version: "0.1.0";
  name: "bucket_program";
  instructions: [
    {
      name: "createBucket";
      accounts: [
        {
          name: "bucket";
          isMut: true;
          isSigner: false;
        },
        {
          name: "crateMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "crateToken";
          isMut: true;
          isSigner: false;
        },
        {
          name: "issueAuthority";
          isMut: true;
          isSigner: false;
        },
        {
          name: "withdrawAuthority";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "crateTokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "bucketBump";
          type: "u8";
        },
        {
          name: "crateBump";
          type: "u8";
        },
        {
          name: "issueAuthorityBump";
          type: "u8";
        },
        {
          name: "withdrawAuthorityBump";
          type: "u8";
        }
      ];
    },
    {
      name: "authorizeCollateral";
      accounts: [
        {
          name: "bucket";
          isMut: true;
          isSigner: false;
        },
        {
          name: "crateToken";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "mint";
          type: "publicKey";
        }
      ];
    },
    {
      name: "deposit";
      accounts: [
        {
          name: "bucket";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "crateToken";
          isMut: false;
          isSigner: false;
        },
        {
          name: "crateMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "collateralReserve";
          isMut: true;
          isSigner: false;
        },
        {
          name: "crateTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "depositor";
          isMut: false;
          isSigner: true;
        },
        {
          name: "depositorSource";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mintDestination";
          isMut: true;
          isSigner: false;
        },
        {
          name: "issueAuthority";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "depositAmount";
          type: "u64";
        }
      ];
    },
    {
      name: "redeem";
      accounts: [
        {
          name: "bucket";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "crateToken";
          isMut: true;
          isSigner: false;
        },
        {
          name: "crateMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "collateralReserve";
          isMut: true;
          isSigner: false;
        },
        {
          name: "crateTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "withdrawer";
          isMut: false;
          isSigner: true;
        },
        {
          name: "withdrawerSource";
          isMut: true;
          isSigner: false;
        },
        {
          name: "withdrawDestination";
          isMut: true;
          isSigner: false;
        },
        {
          name: "withdrawAuthority";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "withdrawAmount";
          type: "u64";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "issueAuthority";
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "withdrawAuthority";
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "bucket";
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "crateMint";
            type: "publicKey";
          },
          {
            name: "crateToken";
            type: "publicKey";
          },
          {
            name: "authority";
            type: "publicKey";
          },
          {
            name: "whitelist";
            type: {
              vec: "publicKey";
            };
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 6000;
      name: "BucketDaoError";
      msg: "BucketDaoError";
    },
    {
      code: 6001;
      name: "WrongCollateralError";
      msg: "Tried to deposit wrong collateral";
    },
    {
      code: 6002;
      name: "WrongBurnError";
      msg: "Tried to burn wrong token";
    }
  ];
};

export const IDL: BucketProgram = {
  version: "0.1.0",
  name: "bucket_program",
  instructions: [
    {
      name: "createBucket",
      accounts: [
        {
          name: "bucket",
          isMut: true,
          isSigner: false,
        },
        {
          name: "crateMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "crateToken",
          isMut: true,
          isSigner: false,
        },
        {
          name: "issueAuthority",
          isMut: true,
          isSigner: false,
        },
        {
          name: "withdrawAuthority",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "crateTokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "bucketBump",
          type: "u8",
        },
        {
          name: "crateBump",
          type: "u8",
        },
        {
          name: "issueAuthorityBump",
          type: "u8",
        },
        {
          name: "withdrawAuthorityBump",
          type: "u8",
        },
      ],
    },
    {
      name: "authorizeCollateral",
      accounts: [
        {
          name: "bucket",
          isMut: true,
          isSigner: false,
        },
        {
          name: "crateToken",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "mint",
          type: "publicKey",
        },
      ],
    },
    {
      name: "deposit",
      accounts: [
        {
          name: "bucket",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "crateToken",
          isMut: false,
          isSigner: false,
        },
        {
          name: "crateMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "collateralReserve",
          isMut: true,
          isSigner: false,
        },
        {
          name: "crateTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "depositor",
          isMut: false,
          isSigner: true,
        },
        {
          name: "depositorSource",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mintDestination",
          isMut: true,
          isSigner: false,
        },
        {
          name: "issueAuthority",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "depositAmount",
          type: "u64",
        },
      ],
    },
    {
      name: "redeem",
      accounts: [
        {
          name: "bucket",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "crateToken",
          isMut: true,
          isSigner: false,
        },
        {
          name: "crateMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "collateralReserve",
          isMut: true,
          isSigner: false,
        },
        {
          name: "crateTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "withdrawer",
          isMut: false,
          isSigner: true,
        },
        {
          name: "withdrawerSource",
          isMut: true,
          isSigner: false,
        },
        {
          name: "withdrawDestination",
          isMut: true,
          isSigner: false,
        },
        {
          name: "withdrawAuthority",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "withdrawAmount",
          type: "u64",
        },
      ],
    },
  ],
  accounts: [
    {
      name: "issueAuthority",
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "withdrawAuthority",
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "bucket",
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "crateMint",
            type: "publicKey",
          },
          {
            name: "crateToken",
            type: "publicKey",
          },
          {
            name: "authority",
            type: "publicKey",
          },
          {
            name: "whitelist",
            type: {
              vec: "publicKey",
            },
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "BucketDaoError",
      msg: "BucketDaoError",
    },
    {
      code: 6001,
      name: "WrongCollateralError",
      msg: "Tried to deposit wrong collateral",
    },
    {
      code: 6002,
      name: "WrongBurnError",
      msg: "Tried to burn wrong token",
    },
  ],
};
