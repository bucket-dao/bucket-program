import { Keypair } from "@solana/web3.js";
import fs from "fs";

var from_b58 = function(
  S,            //Base58 encoded string input
  A             //Base58 characters (i.e. "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")
) {
  var d = [],   //the array for storing the stream of decoded bytes
      b = [],   //the result byte array that will be returned
      i,        //the iterator variable for the base58 string
      j,        //the iterator variable for the byte array (d)
      c,        //the carry amount variable that is used to overflow from the current byte to the next byte
      n;        //a temporary placeholder variable for the current byte
  for(i in S) { //loop through each base58 character in the input string
      j = 0,                             //reset the byte iterator
      c = A.indexOf( S[i] );             //set the initial carry amount equal to the current base58 digit
      if(c < 0)                          //see if the base58 digit lookup is invalid (-1)
          return undefined;              //if invalid base58 digit, bail out and return undefined
      c || b.length ^ i ? i : b.push(0); //prepend the result array with a zero if the base58 digit is zero and non-zero characters haven't been seen yet (to ensure correct decode length)
      while(j in d || c) {               //start looping through the bytes until there are no more bytes and no carry amount
          n = d[j];                      //set the placeholder for the current byte
          n = n ? n * 58 + c : c;        //shift the current byte 58 units and add the carry amount (or just add the carry amount if this is a new byte)
          c = n >> 8;                    //find the new carry amount (1-byte shift of current byte value)
          d[j] = n % 256;                //reset the current byte to the remainder (the carry amount will pass on the overflow)
          j++                            //iterate to the next byte
      }
  }
  while(j--)               //since the byte array is backwards, loop through it in reverse order
      b.push( d[j] );      //append each byte to the result
  return new Uint8Array(b) //return the final byte array in Uint8Array format
}

export const loadWalletKey = (keypair: string): Keypair => {
  if (!keypair || keypair === "") {
    throw new Error("Keypair is required!");
  }

  // If it's a file path
  if (fs.existsSync(keypair)) {
    return Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString()))
    );
  }
  else // Private key exported from Phantom
  {
    return Keypair.fromSecretKey(
      from_b58(keypair, "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")
    );
  }
};
