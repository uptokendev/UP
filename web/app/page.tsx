'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Providers from './providers';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Connection,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { getProgram } from '../lib/anchorClient';
import { BN } from '@coral-xyz/anchor';

import Header from "../components/Header";
import Hero from "../components/Hero";
import SocialLinks from "../components/SocialLinks";
import AdminOnly from "../components/AdminOnly";
import DaysHolding from '../components/DaysHolding';

// Token-2022 + ATA program IDs
const TOKEN22 = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// Prefer configuring decimals via env
const DECIMALS = Number(process.env.NEXT_PUBLIC_DECIMALS ?? '9');

function toRaw(amountUi: string, decimals: number) {
  const [i, f = ''] = amountUi.trim().split('.');
  const fpad = (f + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(i || '0') * (10n ** BigInt(decimals)) + BigInt(fpad || '0');
}

function useCountdown(start: number, len: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!start || !len) return '—';
  const end = (start + len) * 1000;
  const s = Math.max(0, Math.floor((end - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

/** ===== ATA helpers (no @solana/spl-token) ===== */
function deriveAta(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN22.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

function createAtaIdempotentIx(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey
) {
  const keys = [
    { pubkey: payer,               isSigner: true,  isWritable: true  },
    { pubkey: ata,                 isSigner: false, isWritable: true  },
    { pubkey: owner,               isSigner: false, isWritable: false },
    { pubkey: mint,                isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN22,                 isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false },
  ];
  const data = Buffer.from([1]); // CreateIdempotent
  return new TransactionInstruction({ keys, programId: ASSOCIATED_TOKEN_PROGRAM_ID, data });
}

/** ---------- Wrapper: mount Providers here ---------- */
export default function Page() {
  return (
    <Providers>
      <Dashboard />
    </Providers>
  );
}

/** ---------- Actual page that uses useWallet() ---------- */
function Dashboard() {
  const wallet = useWallet();

  const [cfg, setCfg] = useState<any>(null);
  const [authority, setAuthority] = useState('');
  const [balance, setBalance] = useState('0');
  const [status, setStatus] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amountUi, setAmountUi] = useState('');
  const [enforce, setEnforce] = useState(false);

  // Dev tools state
  const [mintTo, setMintTo] = useState('');            // faucet target
  const [newAuthority, setNewAuthority] = useState(''); // program authority transfer

  const rpc = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
  const MINT = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_MINT!), []);
  const DEV_WALLET = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_DEV_WALLET!), []);
  const REFLECTION_VAULT = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_REFLECTION_VAULT!), []);
  const HOLD_POOL_VAULT = useMemo(() => new PublicKey(process.env.NEXT_PUBLIC_HOLD_POOL_VAULT!), []);

  const isAdmin = authority && wallet.publicKey?.toBase58() === authority;
  const countdown = useCountdown(cfg?.currentEpochStart || 0, cfg?.epochLength || 0);

  async function load() {
    try {
      const program = await getProgram();
      const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], program.programId);
      const c: any = await program.account.globalConfig.fetch(configPda);
      setCfg(c);
      setAuthority(c.authority.toBase58());
      setEnforce(c.enforceHook);

      // balance
      if (wallet.publicKey) {
        const conn = new Connection(rpc, 'confirmed');
        const ata = deriveAta(wallet.publicKey, MINT);
        const info = await conn.getTokenAccountBalance(ata).catch(() => null);
        setBalance(info?.value?.uiAmountString || '0');
      }
    } catch (e: any) {
      setStatus(e.message || String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.publicKey]);

  async function toggle() {
    try {
      setStatus('Toggling enforcement...');
      const p = await getProgram();
      await p.methods.setHookMode(!enforce).rpc();
      setEnforce(!enforce);
      setStatus('Done');
    } catch (e: any) {
      setStatus(e.message || String(e));
    }
  }

  async function send() {
    try {
      if (!wallet.publicKey) throw new Error('Connect wallet first');

      // Basic validation
      const rec = recipient.trim();
      if (!rec) throw new Error("Enter recipient address");
      let toOwner: PublicKey;
      try { toOwner = new PublicKey(rec); } catch { throw new Error("Invalid recipient address"); }

      const amt = amountUi.trim();
      if (!amt) throw new Error("Enter amount");
      const amtNum = Number(amt);
      if (!isFinite(amtNum) || amtNum <= 0) throw new Error("Amount must be a positive number");

      setStatus('Preparing transfer...');
      const program = await getProgram();
      const conn = new Connection(rpc, 'confirmed');

      // ensure ATAs
      const payer = wallet.publicKey;
      const fromAta = deriveAta(payer, MINT);
      const toAta   = deriveAta(toOwner, MINT);
      const devAta  = deriveAta(DEV_WALLET, MINT);

      const ixs: TransactionInstruction[] = [];
      if (!(await conn.getAccountInfo(fromAta))) ixs.push(createAtaIdempotentIx(payer, fromAta, payer, MINT));
      if (!(await conn.getAccountInfo(toAta)))   ixs.push(createAtaIdempotentIx(payer, toAta, toOwner, MINT));
      if (!(await conn.getAccountInfo(devAta)))  ixs.push(createAtaIdempotentIx(payer, devAta, DEV_WALLET, MINT));

      if (ixs.length > 0) {
        const tx = new Transaction().add(...ixs);
        // @ts-ignore AnchorProvider has sendAndConfirm
        await (program.provider as any).sendAndConfirm(tx, []);
      }

      // derive epoch PDA for lazy rollover
      const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], program.programId);
      const cfgAcc: any = await program.account.globalConfig.fetch(configPda);
      const epochLen = Number(cfgAcc.epochLength);
      if (!epochLen) throw new Error("Config: epochLength is zero");

      const nextId = BigInt(Math.floor(Number(cfgAcc.currentEpochStart) / epochLen) + 1);
      const seed = Buffer.alloc(8); seed.writeBigUInt64LE(nextId);
      const [epochPda] = PublicKey.findProgramAddressSync([Buffer.from('epoch'), seed], program.programId);

      const raw = toRaw(amt, DECIMALS);

      setStatus('Sending...');
      const txSig = await program.methods
        .programTransfer(new BN(raw.toString()))
        .accounts({
          config: configPda,
          mint: MINT,
          fromToken: fromAta,
          toToken: toAta,
          devToken: devAta,
          reflectionVault: REFLECTION_VAULT,
          holdPoolVault: HOLD_POOL_VAULT,
          tokenProgram: TOKEN22,
          signer: payer,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([{ pubkey: epochPda, isWritable: true, isSigner: false }])
        .rpc();

      setStatus('Transfer submitted: ' + txSig);
      setAmountUi('');
      await load();
    } catch (e: any) {
      setStatus(e.message || String(e));
    }
  }

  // Dev faucet (server API)
  async function faucetTo() {
    try {
      const to = (mintTo || wallet.publicKey?.toBase58() || '').trim();
      if (!to) throw new Error('Provide a destination or connect a wallet');
      setStatus(`Minting 1000 $UP to ${to.slice(0,4)}…${to.slice(-4)}...`);
      const amountRaw = (BigInt(1000) * (10n ** BigInt(DECIMALS))).toString();
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to, amount: amountRaw }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Faucet failed');
      setStatus(`Minted. Signature: ${j.signature}`);
      await load();
    } catch (e:any) {
      setStatus(e.message || String(e));
    }
  }

  // Transfer on-chain authority (if your program exposes setAuthority)
  async function transferAuthority() {
    try {
      if (!wallet.publicKey) throw new Error('Connect with current authority');
      setStatus('Transferring authority...');
      const program = await getProgram();
      await program.methods
        .setAuthority(new PublicKey(newAuthority))
        .rpc();
      setStatus('Authority updated');
      await load();
    } catch (e:any) {
      setStatus(e.message || String(e));
    }
  }

  return (
    <div className="min-h-dvh bg-[#0b0b14] text-white">
      <Header />

      <Hero>
        <div className="mt-6">
          <DaysHolding mintAddress={process.env.NEXT_PUBLIC_MINT!} />
        </div>
      </Hero>

      <main className="mx-auto my-10 w-full max-w-6xl px-4">
        <div className="card">
          <b>Your $UP</b>
          <div>Balance: <b>{balance}</b></div>
        </div>

        <AdminOnly>
          <div className="card">
            <b>Dev Faucet</b>
            <div className="text-white/70">Mint test tokens on devnet.</div>
            <div className="row mt-3">
              <div className="col">
                <label>Mint to (pubkey, optional)</label>
                <input
                  value={mintTo}
                  onChange={e => setMintTo(e.target.value)}
                  placeholder="Leave empty to use connected wallet"
                />
              </div>
              <div className="col" style={{ display:'flex', alignItems:'flex-end' }}>
                <button className="btn" onClick={faucetTo}>Mint 1000 $UP</button>
              </div>
            </div>
            <div className="text-white/60 mt-2 text-sm">Faucet is devnet-only and must be enabled in env.</div>
          </div>
        </AdminOnly>

        <AdminOnly>
          <div className="card">
            <b>Transfer Program Authority</b>
            <div className="text-white/70">Requires signature from the current authority.</div>
            <div className="row mt-3">
              <div className="col">
                <label>New Authority (pubkey)</label>
                <input
                  value={newAuthority}
                  onChange={e => setNewAuthority(e.target.value)}
                  placeholder="New admin public key"
                />
              </div>
              <div className="col" style={{ display:'flex', alignItems:'flex-end' }}>
                <button className="btn" onClick={transferAuthority}>Transfer</button>
              </div>
            </div>
          </div>
        </AdminOnly>

        <div className="card">
          <b>Weekly Rewards</b>
          <div>Next epoch in: {countdown}</div>
        </div>

        <div className="card">
          <b>Send $UP (fees apply)</b>
          <label>Recipient address</label>
          <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Enter Solana address" />
          <div className="row">
            <div className="col">
              <label>Amount (UI units)</label>
              <input value={amountUi} onChange={e => setAmountUi(e.target.value)} placeholder="e.g. 100.5" />
            </div>
            <div className="col" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn" onClick={send}>Send via Program</button>
            </div>
          </div>
          <div style={{ opacity: .7, marginTop: 8 }}>
            This routes through the $UP program so 1% burn, 1% reflection, 1% dev, 0.5% weekly pool are applied.
          </div>
        </div>

        <AdminOnly>
          <div className="card">
            <b>Hook Enforcement</b>
            <div>Status: <b>{enforce ? 'ON' : 'OFF'}</b></div>
            {isAdmin && <button className="btn" onClick={toggle}>{enforce ? 'Disable' : 'Enable'}</button>}
            <div style={{ opacity: .7, marginTop: 8 }}>
              When ON, wallet “Send” is blocked; use this page or any integrated app to transfer.
            </div>
          </div>
        </AdminOnly>

        {status && <div className="card"><b>Status:</b> {status}</div>}
      </main>

      <footer className="mx-auto mt-14 w-full max-w-6xl px-4 pb-16 text-white/60">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="mt-6"><SocialLinks /></div>
        <p className="mt-4 text-xs">© {new Date().getFullYear()} UP — all systems go 🚀</p>
      </footer>
    </div>
  );
}