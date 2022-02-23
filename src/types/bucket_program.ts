export type BucketProgram = {
  "version": "0.1.0",
  "name": "bucket_program",
  "instructions": [
    {
      "name": "createBucket",
      "accounts": [
        {
          "name": "bucket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bucketMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "bucketTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "issueAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "withdrawAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
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
            "name": "bucketMint",
            "type": "publicKey"
          },
          {
            "name": "bucketTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "updateAuthority",
            "type": "publicKey"
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
          "name": "bucket",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bucketMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "bucketTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "issueAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "withdrawAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
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
            "name": "bucketMint",
            "type": "publicKey"
          },
          {
            "name": "bucketTokenAccount",
            "type": "publicKey"
          },
          {
            "name": "updateAuthority",
            "type": "publicKey"
          }
        ]
      }
    }
  ]
};
