// app/api/faucet/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  PublicKey,
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

/** Program IDs */
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

/** Derive Token-2022 ATA: PDA[ owner, TOKEN_2022_PROGRAM_ID, mint ] */
function deriveAta(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

/** CreateAssociatedTokenAccountIdempotent (for Token-2022) */
function createAtaIdempotentIx(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey
) {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true }, // payer
    { pubkey: ata, isSigner: false, isWritable: true }, // associated token account
    { pubkey: owner, isSigner: false, isWritable: false }, // owner
    { pubkey: mint, isSigner: false, isWritable: false }, // mint
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  // data[0] = 1 => CreateIdempotent
  const data = Buffer.from([1]);
  return new TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data,
  });
}

/** MintTo (Token-2022): discriminator 7 + u64 amount (LE) */
function createMintToIx(
  mint: PublicKey,
  destAta: PublicKey,
  mintAuthority: PublicKey,
  amount: bigint
) {
  const keys = [
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: destAta, isSigner: false, isWritable: true },
    { pubkey: mintAuthority, isSigner: true, isWritable: false },
  ];
  const data = Buffer.alloc(1 + 8);
  data[0] = 7; // MintTo
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
    keys,
    programId: TOKEN_2022_PROGRAM_ID,
    data,
  });
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.ENABLE_FAUCET !== "true") {
      return NextResponse.json({ error: "Faucet disabled" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const to = body?.to as string | undefined;
    const rawAmount = body?.amount as string | undefined; // integer string (in raw units)

    if (!to || !rawAmount) {
      return NextResponse.json({ error: "`to` and `amount` required" }, { status: 400 });
    }

    const rpc = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
    if (!/devnet/.test(rpc)) {
      // Safety: faucet on devnet only
      return NextResponse.json({ error: "Faucet allowed on devnet only" }, { status: 403 });
    }

    const MINT = process.env.NEXT_PUBLIC_MINT;
    const SECRET = process.env.MINT_AUTHORITY_SECRET; // JSON array of numbers

    if (!MINT || !SECRET) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const connection = new Connection(rpc, "confirmed");
    const mint = new PublicKey(MINT);
    const owner = new PublicKey(to);
    const secretBytes = Uint8Array.from(JSON.parse(SECRET));
    const mintAuthority = Keypair.fromSecretKey(secretBytes);

    const ata = deriveAta(owner, mint);

    const ixs: TransactionInstruction[] = [];
    const ataInfo = await connection.getAccountInfo(ata);
    if (!ataInfo) {
      ixs.push(createAtaIdempotentIx(mintAuthority.publicKey, ata, owner, mint));
    }
    ixs.push(createMintToIx(mint, ata, mintAuthority.publicKey, BigInt(rawAmount)));

    const tx = new Transaction().add(...ixs);
    const sig = await sendAndConfirmTransaction(connection, tx, [mintAuthority]);

    return NextResponse.json({ signature: sig, ata: ata.toBase58() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
