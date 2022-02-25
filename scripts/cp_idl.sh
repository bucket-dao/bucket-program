# ------- copy IDL and types
# IDL to app
cp ./target/idl/bucket_program.json ./app/public/

# ------- types to SDK
cp -r target/types ./src

echo IDLs and Types copied ✅