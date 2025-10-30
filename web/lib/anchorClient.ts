'use client';

import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import idl from '../../idl/up_token.json'; // your IDL file name

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
  // fallback to IDL metadata if present
  ((idl as any).metadata?.address ?? 'REPLACE_ME_IF_NO_METADATA')
);

export async function getProgram() {
  const rpc = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpc, 'confirmed');

  // Use injected wallet (Phantom/Solflare/etc.)
  const wallet = (window as any).solana;
  if (!wallet || !wallet.publicKey) {
    throw new Error('Connect a wallet first');
  }

  const provider = new anchor.AnchorProvider(connection, wallet as any, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  const idlRes = await fetch('/idl/up_token.json');
  if (!idlRes.ok) throw new Error('IDL not found at /idl/up_token.json');
  const idl = (await idlRes.json()) as anchor.Idl;

  const programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);

  // Construct via `any` to sidestep constructor signature differences across Anchor versions.
  const program = new (anchor as any).Program(idl, programId, provider);
  return program as any;
}
