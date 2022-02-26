#!/usr/bin/env bash
echo installing root packages
yarn install 
anchor build 
yarn cp-idl

echo installing sdk packages
cd sdk
yarn install 
yarn build 

echo running program tests
cd .. 
anchor test 

echo installing client packages
cd app 
yarn install

echo installing cli packages
cd ../cli
yarn install

echo installed all packages ✅