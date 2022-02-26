if [ $# -gt 1 ]; then
    echo "Cluster name is the only optional accepted parameter: devnet, mainnet-beta"
    exit 1
fi

network='devnet' # set default if param not specified
if [ $# -ne 0 ]; then
    if [ "$1" = devnet ]; then
        network='devnet'
     elif [ "$1" = mainnet-beta ]; then
        network='mainnet-beta'
    else
        echo "devnet, mainnet-beta are the only acceptable cluster names"
        exit 1
    fi
fi

echo "Deplying to $network";

# fetch old pk
old_bucket_pk=`solana-keygen pubkey ./target/deploy/bucket_program-keypair.json`
echo Old public key: $old_bucket_pk

# stash old keypair
cd ./target/deploy # need to cd for renaming to work ok
mv bucket_program-keypair.json bucket_program-keypair-`ls | wc -l | xargs`.json
cd ./../..

# build and fetch new pk
anchor build
new_bucket_pk=`solana-keygen pubkey ./target/deploy/bucket_program-keypair.json`
echo New public key: $new_bucket_pk

targets=$(find . -type f  -exec grep -lir --include=*.{ts,tsx,rs,toml} $old_bucket_pk {} +)
for target in $targets
do
    sed -i'.original' -e "s/$old_bucket_pk/$new_bucket_pk/g" $target
done
echo Public key replaced!

# build again with new pk
anchor build

# copy idl
sh scripts/cp_idl.sh

# deploy!
solana balance # enough lamports left for deployment?
anchor deploy --provider.cluster $network
echo "DEPLOYED TO $network"
solana balance
