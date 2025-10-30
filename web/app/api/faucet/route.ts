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
import bs58 from "bs58";

/** Program IDs */
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("2JZV7F2XYcyk4zqiExQ6Q5UMx6EbQbheP6sD6edAkq4k");

/** Derive Token-2022 ATA: PDA[ owner, TOKEN_2022_PROGRAM_ID, mint ] */
function deriveAta(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

/** CreateAssociatedTokenAccountIdempotent (for Token-2022) */
function createAtaIdempotentIx(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey) {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: ata, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  const data = Buffer.from([1]); // 1 = CreateIdempotent
  return new TransactionInstruction({ keys, programId: ASSOCIATED_TOKEN_PROGRAM_ID, data });
}

/** MintTo (Token-2022): discriminator 7 + u64 amount (LE) */
function createMintToIx(mint: PublicKey, destAta: PublicKey, mintAuthority: PublicKey, amount: bigint) {
  const keys = [
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: destAta, isSigner: false, isWritable: true },
    { pubkey: mintAuthority, isSigner: true, isWritable: false },
  ];
  const data = Buffer.alloc(1 + 8);
  data[0] = 7; // MintTo
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({ keys, programId: TOKEN_2022_PROGRAM_ID, data });
}

function decodeMintAuthority(secret: string): Uint8Array {
  // Accept JSON array or base58 string
  const trimmed = secret.trim();
  if (trimmed.startsWith("[")) {
    return Uint8Array.from(JSON.parse(trimmed));
  }
  // base58 path
  return bs58.decode(trimmed);
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.ENABLE_FAUCET !== "true") {
      return NextResponse.json({ error: "Faucet disabled" }, { status: 403 });
    }

    const { to, amount } = await req.json().catch(() => ({}));
    if (!to || !amount) {
      return NextResponse.json({ error: "`to` and `amount` required" }, { status: 400 });
    }

    const rpc = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
    if (!/devnet/.test(rpc)) {
      return NextResponse.json({ error: "Faucet allowed on devnet only" }, { status: 403 });
    }

    const MINT = process.env.NEXT_PUBLIC_MINT;
    const SECRET = process.env.MINT_AUTHORITY_SECRET;
    if (!MINT || !SECRET) {
      return NextResponse.json({ error: "Server not configured (MINT or SECRET missing)" }, { status: 500 });
    }

    let secretBytes: Uint8Array;
    try {
      secretBytes = decodeMintAuthority(SECRET);
    } catch (e: any) {
      return NextResponse.json({ error: "Invalid MINT_AUTHORITY_SECRET (must be JSON array or base58)" }, { status: 400 });
    }

    const connection = new Connection(rpc, "confirmed");
    const mint = new PublicKey(MINT);
    const owner = new PublicKey(to);
    const mintAuthority = Keypair.fromSecretKey(secretBytes);

    const ata = deriveAta(owner, mint);
    const ixs: TransactionInstruction[] = [];

    const ataInfo = await connection.getAccountInfo(ata);
    if (!ataInfo) {
      ixs.push(createAtaIdempotentIx(mintAuthority.publicKey, ata, owner, mint));
    }
    ixs.push(createMintToIx(mint, ata, mintAuthority.publicKey, BigInt(amount)));

    const tx = new Transaction().add(...ixs);
    const sig = await sendAndConfirmTransaction(connection, tx, [mintAuthority]);

    return NextResponse.json({ signature: sig, ata: ata.toBase58() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
