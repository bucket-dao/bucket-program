# ------- copy IDL and types
# IDL to app
cp ./target/idl/bucket_program.json ./app/public/

# ------- types to SDK
cp -r target/types ./src/types/

echo IDLs and Types copied ✅