import * as anchor from '@project-serum/anchor';

describe('bucket-program', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  it('Is initialized!', async () => {
    // Add your test here.
    const program = anchor.workspace.BucketProgram;
    const tx = await program.rpc.create();
    console.log("Your transaction signature", tx);
  });
});
