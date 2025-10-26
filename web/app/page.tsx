'use client';
import React,{useEffect,useMemo,useState} from 'react';
import Providers from './providers';
import {WalletMultiButton} from '@solana/wallet-adapter-react-ui';
import {useWallet} from '@solana/wallet-adapter-react';
import {PublicKey,Connection,SystemProgram} from '@solana/web3.js';
import {getProgram} from '../lib/anchorClient';
import {TOKEN_2022_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID,getAssociatedTokenAddress,createAssociatedTokenAccountInstruction,getMint} from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';

function toRaw(amountUi:string, decimals:number){ const [i,f='']=amountUi.split('.'); const fpad=(f+'0'.repeat(decimals)).slice(0,decimals); return BigInt(i+fpad); }
function useCountdown(start:number,len:number){ const [now,setNow]=useState(Date.now()); useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),1000); return()=>clearInterval(t)},[]); if(!start||!len)return'—'; const end=(start+len)*1000; const s=Math.max(0,Math.floor((end-now)/1000)); const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=s%60; return `${d}d ${h}h ${m}m ${sec}s`; }

export default function Page(){
  const wallet=useWallet();
  const [cfg,setCfg]=useState<any>(null);
  const [authority,setAuthority]=useState('');
  const [decimals,setDecimals]=useState<number>(9);
  const [balance,setBalance]=useState('0');
  const [status,setStatus]=useState('');
  const [recipient,setRecipient]=useState('');
  const [amountUi,setAmountUi]=useState('');
  const [enforce,setEnforce]=useState(false);

  const rpc=process.env.NEXT_PUBLIC_RPC_URL||'https://api.devnet.solana.com';
  const MINT = useMemo(()=> new PublicKey(process.env.NEXT_PUBLIC_MINT!), []);
  const DEV_WALLET = useMemo(()=> new PublicKey(process.env.NEXT_PUBLIC_DEV_WALLET!), []);
  const REFLECTION_VAULT = useMemo(()=> new PublicKey(process.env.NEXT_PUBLIC_REFLECTION_VAULT!), []);
  const HOLD_POOL_VAULT = useMemo(()=> new PublicKey(process.env.NEXT_PUBLIC_HOLD_POOL_VAULT!), []);

  const isAdmin = authority && wallet.publicKey?.toBase58()===authority;
  const countdown = useCountdown(cfg?.currentEpochStart||0, cfg?.epochLength||0);

  async function load(){
    try{
      const program=await getProgram();
      const [configPda]=PublicKey.findProgramAddressSync([Buffer.from('config')], program.programId);
      const c:any = await program.account.globalConfig.fetch(configPda);
      setCfg(c); setAuthority(c.authority.toBase58()); setEnforce(c.enforceHook);
      // mint decimals
      const conn=new Connection(rpc,'confirmed');
      const mintInfo=await getMint(conn, MINT, undefined, TOKEN_2022_PROGRAM_ID);
      setDecimals(mintInfo.decimals);
      // balance
      if(wallet.publicKey){
        const ata=await getAssociatedTokenAddress(MINT, wallet.publicKey, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
        const info=await conn.getTokenAccountBalance(ata).catch(()=>null);
        setBalance(info?.value?.uiAmountString||'0');
      }
    }catch(e:any){ setStatus(e.message||String(e)); }
  }
  useEffect(()=>{ load(); /* eslint-disable */ },[wallet.publicKey?.toBase64?.() || wallet.publicKey?.toBase58?.()]);

  async function toggle(){
    try{ setStatus('Toggling enforcement...'); const p=await getProgram(); await p.methods.setHookMode(!enforce).rpc(); setEnforce(!enforce); setStatus('Done'); }catch(e:any){ setStatus(e.message||String(e)); }
  }

  async function send(){
    try{
      if(!wallet.publicKey) throw new Error('Connect wallet first');
      setStatus('Preparing transfer...');
      const program=await getProgram(); const conn=new Connection(rpc,'confirmed');
      // ensure ATAs
      const payer=wallet.publicKey;
      const toOwner=new PublicKey(recipient);
      const fromAta=await getAssociatedTokenAddress(MINT, payer, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      const toAta=await getAssociatedTokenAddress(MINT, toOwner, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      const devAta=await getAssociatedTokenAddress(MINT, DEV_WALLET, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      const ixs=[] as any[];
      const fromInfo=await conn.getAccountInfo(fromAta);
      if(!fromInfo){ ixs.push(createAssociatedTokenAccountInstruction(payer, fromAta, payer, MINT, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)); }
      const toInfo=await conn.getAccountInfo(toAta);
      if(!toInfo){ ixs.push(createAssociatedTokenAccountInstruction(payer, toAta, toOwner, MINT, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)); }
      const devInfo=await conn.getAccountInfo(devAta);
      if(!devInfo){ ixs.push(createAssociatedTokenAccountInstruction(payer, devAta, DEV_WALLET, MINT, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)); }
      if(ixs.length>0){ await (program.provider as any).sendAndConfirm({instructions: ixs}); }
      // derive epoch PDA for lazy rollover
      const [configPda]=PublicKey.findProgramAddressSync([Buffer.from('config')], program.programId);
      const cfgAcc:any = await program.account.globalConfig.fetch(configPda);
      const nextId = BigInt((Number(cfgAcc.currentEpochStart)/Number(cfgAcc.epochLength))+1);
      const seed = Buffer.alloc(8); seed.writeBigUInt64LE(nextId);
      const [epochPda] = PublicKey.findProgramAddressSync([Buffer.from('epoch'), seed], program.programId);
      const raw = toRaw(amountUi, decimals);
      setStatus('Sending...');
      const tx = await program.methods.programTransfer(new BN(raw.toString())).accounts({
        config: configPda, mint: MINT, fromToken: fromAta, toToken: toAta, devToken: devAta,
        reflectionVault: REFLECTION_VAULT, holdPoolVault: HOLD_POOL_VAULT,
        tokenProgram: TOKEN_2022_PROGRAM_ID, signer: payer, systemProgram: SystemProgram.programId
      }).remainingAccounts([{pubkey: epochPda, isWritable: true, isSigner: false}]).rpc();
      setStatus('Transfer submitted: '+tx);
      setAmountUi('');
      await load();
    }catch(e:any){ setStatus(e.message||String(e)); }
  }

  return (<Providers>
    <div style={{maxWidth:900,margin:'0 auto',padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><b>$UP</b> Dashboard</div>
        <WalletMultiButton className='btn'/>
      </div>

      <div className='card'>
        <b>Your $UP</b>
        <div>Balance: <b>{balance}</b></div>
      </div>

      <div className='card'>
        <b>Weekly Rewards</b>
        <div>Next epoch in: {countdown}</div>
      </div>

      <div className='card'>
        <b>Send $UP (fees apply)</b>
        <label>Recipient address</label>
        <input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder='Enter Solana address'/>
        <div className='row'>
          <div className='col'>
            <label>Amount (UI units)</label>
            <input value={amountUi} onChange={e=>setAmountUi(e.target.value)} placeholder='e.g. 100.5'/>
          </div>
          <div className='col' style={{display:'flex',alignItems:'flex-end'}}>
            <button className='btn' onClick={send}>Send via Program</button>
          </div>
        </div>
        <div style={{opacity:.7,marginTop:8}}>This routes through the $UP program so 1% burn, 1% reflection, 1% dev, 0.5% weekly pool are applied.</div>
      </div>

      <div className='card'>
        <b>Hook Enforcement</b>
        <div>Status: <b>{enforce?'ON':'OFF'}</b></div>
        {isAdmin && <button className='btn' onClick={toggle}>{enforce?'Disable':'Enable'}</button>}
        <div style={{opacity:.7,marginTop:8}}>When ON, wallet “Send” is blocked; use this page or any integrated app to transfer.</div>
      </div>

      {status && <div className='card'><b>Status:</b> {status}</div>}
    </div>
  </Providers>);
}
