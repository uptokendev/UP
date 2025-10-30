// app/api/faucet/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  PublicKey, Connection, Keypair, Transaction,
  TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY,
  SendTransactionError
} from '@solana/web3.js';
import bs58 from 'bs58';

const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

function deriveAta(owner: PublicKey, mint: PublicKey) {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}
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
  const data = Buffer.from([1]); // CreateIdempotent
  return new TransactionInstruction({ keys, programId: ASSOCIATED_TOKEN_PROGRAM_ID, data });
}
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
function decodeSecret(input: string): Uint8Array {
  const s = input.trim();
  if (s.startsWith('[')) return Uint8Array.from(JSON.parse(s));
  return bs58.decode(s);
}

// Simple GET health check so you can open it in the browser
export async function GET() {
  const rpc = process.env.NEXT_PUBLIC_RPC_URL || '(missing)';
  const mint = process.env.NEXT_PUBLIC_MINT || '(missing)';
  const enabled = process.env.ENABLE_FAUCET || '(missing)';
  const pub = process.env.MINT_AUTHORITY_PUBKEY || '(missing)';
  const secret = !!process.env.MINT_AUTHORITY_SECRET;
  return NextResponse.json({ ok: true, rpc, mint, faucetEnabled: enabled, hasSecret: secret, mintAuthorityPubkey: pub });
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.ENABLE_FAUCET !== 'true') {
      return NextResponse.json({ error: 'Faucet disabled' }, { status: 403 });
    }
    const { to, amount } = await req.json().catch(() => ({}));
    if (!to || !amount) return NextResponse.json({ error: '`to` and `amount` required' }, { status: 400 });

    const rpc = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
    if (!/devnet/.test(rpc)) return NextResponse.json({ error: 'Faucet allowed on devnet only' }, { status: 403 });

    const MINT = process.env.NEXT_PUBLIC_MINT;
    const SECRET = process.env.MINT_AUTHORITY_SECRET;
    const EXPECTED_PUB = process.env.MINT_AUTHORITY_PUBKEY;
    if (!MINT || !SECRET) {
      return NextResponse.json({ error: 'Server not configured (MINT or SECRET missing)' }, { status: 500 });
    }

    let secretBytes: Uint8Array;
    try { secretBytes = decodeSecret(SECRET); }
    catch { return NextResponse.json({ error: 'Invalid MINT_AUTHORITY_SECRET (JSON array or base58 required)' }, { status: 400 }); }

    const mintAuthority = Keypair.fromSecretKey(secretBytes);
    if (EXPECTED_PUB) {
      const expected = new PublicKey(EXPECTED_PUB);
      if (!mintAuthority.publicKey.equals(expected)) {
        return NextResponse.json(
          { error: 'Secret does not match MINT_AUTHORITY_PUBKEY',
            derived: mintAuthority.publicKey.toBase58(), expected: expected.toBase58() },
          { status: 400 }
        );
      }
    }

    const connection = new Connection(rpc, 'confirmed');
    const mint = new PublicKey(MINT);
    const owner = new PublicKey(to);

    const ata = deriveAta(owner, mint);
    const ixs: TransactionInstruction[] = [];
    const ataInfo = await connection.getAccountInfo(ata);
    if (!ataInfo) ixs.push(createAtaIdempotentIx(mintAuthority.publicKey, ata, owner, mint));
    ixs.push(createMintToIx(mint, ata, mintAuthority.publicKey, BigInt(amount)));

    const tx = new Transaction().add(...ixs);
    try {
      const sig = await connection.sendTransaction(tx, [mintAuthority], { skipPreflight: false });
      await connection.confirmTransaction(sig, 'confirmed');
      return NextResponse.json({ signature: sig, ata: ata.toBase58(), mintAuthority: mintAuthority.publicKey.toBase58() });
    } catch (e: any) {
      // Expose cluster logs to your Status card
      if (e instanceof SendTransactionError && e.logs) {
        return NextResponse.json({ error: 'sendTransaction failed', logs: e.logs }, { status: 500 });
      }
      return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
