# ------- copy IDL and types
# IDL to app
cp ./target/idl/bucket_program.json ./app/src/types/

# ------- types to SDK
cp -r target/types ./sdk/src

echo IDLs and Types copied ✅