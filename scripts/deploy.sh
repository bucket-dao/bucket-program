if [ $# -eq 0 ]; then
    echo "Must provide at least 1 param to specify if script should update programId"
    exit 1
fi

if [ $# -eq 1 ]; then
    echo "Must provide at least 1 param to specify if program is upgraded or deployed"
    exit 1
fi
update_flag=$1

network='devnet' # set default if param not specified
if [ $# -eq 2 ]; then
    if [ "$2" = devnet ]; then
        network='devnet'
     elif [ "$2" = mainnet-beta ]; then
        network='mainnet-beta'
    else
        echo "devnet, mainnet-beta are the only acceptable cluster names"
        exit 1
    fi
fi

echo "Deplying to $network";

# fetch existing pk
existing_bucket_pk=`solana-keygen pubkey ./target/deploy/bucket_program-keypair.json`
echo Existing public key: $existing_bucket_pk

# if we do not upgrade, we will deploy a new copy of the program
if [ $update_flag -ne 1 ]; then
    # stash existing keypair
    cd ./target/deploy # need to cd for renaming to work ok
    mv bucket_program-keypair.json bucket_program-keypair-`ls | wc -l | xargs`.json
    cd ./../..

    # build and fetch new pk
    anchor build
    new_bucket_pk=`solana-keygen pubkey ./target/deploy/bucket_program-keypair.json`
    echo New public key: $new_bucket_pk

    targets=$(find . -type f  -exec grep -lir --include=*.{ts,tsx,rs,toml} $existing_bucket_pk {} +)
    for target in $targets
    do
        echo 'Replacing pk in ' $target
        sed -i'.original' -e "s/$existing_bucket_pk/$new_bucket_pk/g" $target
    done
    echo Public key replaced!
else
    echo Using existing public key: $existing_bucket_pk
fi

# build again with new pk
anchor build

# copy idl
sh scripts/cp_idl.sh

# deploy!
solana balance # enough lamports left for deployment?
anchor deploy --provider.cluster $network
echo "DEPLOYED TO $network"
solana balance
