import * as anchor from '@project-serum/anchor';

import { BucketClient } from '../src/index';

describe('bucket-program', () => {
  const _provider = anchor.Provider.env();
  const client = new BucketClient(
    _provider.connection, _provider.wallet as any
  );

  it('Is initialized!', async () => {
    client.createBucket();
  });
});
