import {
    Connection,
    Keypair,
    PublicKey,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import { AccountUtils } from "./account-utils";

export class NodeWallet extends AccountUtils {
    wallet: Wallet; // instantiate with node wallet

    constructor(connection: Connection, wallet: Wallet) {
        super(connection);
        this.wallet = wallet;
    }

    fundWallet = async (wallet: PublicKey, lamports: number): Promise<void> => {
        const transferTx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: this.wallet.publicKey,
                toPubkey: wallet,
                lamports,
            })
        );

        await sendAndConfirmTransaction(this.conn, transferTx, [
            this.wallet.payer,
        ]);
    };

    createFundedWallet = async (lamports: number): Promise<Keypair> => {
        const wallet = Keypair.generate();
        await this.fundWallet(wallet.publicKey, lamports);
        return wallet;
    };
}