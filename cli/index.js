#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs"; import path from "path";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

const programName="up_token"; const program=new Command(); program.name("up").description("$UP CLI").version("0.6.0");
function repoRoot(){ let dir=path.join(process.cwd(),".."); for(let i=0;i<6;i++){ const idl=path.join(dir,"target","idl",`${programName}.json`); if(fs.existsSync(idl)) return dir; dir=path.join(dir,".."); } throw new Error("IDL missing. Run anchor build at repo root."); }
function load(){ const root=repoRoot(); const idl=JSON.parse(fs.readFileSync(path.join(root,"target","idl",`${programName}.json`),"utf8")); const cfg=JSON.parse(fs.readFileSync(path.join(process.cwd(),"config.json"),"utf8")); return { idl, cfg, programId:new PublicKey(cfg.programId) }; }
function provider(){ return AnchorProvider.env(); }
function client(){ const { idl, programId } = load(); return new Program(idl, programId, provider()); }

program.command("config").requiredOption("--program <PROGRAM_ID>").requiredOption("--mint <MINT>").requiredOption("--dev <DEV>").requiredOption("--refl <REFL>").requiredOption("--pool <POOL>").action((o)=>{ fs.writeFileSync("config.json", JSON.stringify({programId:o.program,mint:o.mint,devWallet:o.dev,reflectionVault:o.refl,holdPoolVault:o.pool},null,2)); console.log("Saved cli/config.json"); });

program.command("set-hook-mode").requiredOption("--enforce <true_or_false>").action(async(o)=>{ const enforce=String(o.enforce).toLowerCase()==="true"; const prog=client(); const [configPda]=PublicKey.findProgramAddressSync([Buffer.from("config")], prog.programId); await prog.methods.setHookMode(enforce).accounts({config:configPda,authority:provider().wallet.publicKey}).rpc(); const authPda=PublicKey.findProgramAddressSync([Buffer.from("auth")], prog.programId)[0]; console.log("Hook enforcement:", enforce); console.log("Register Extra Metas: config =", configPda.toBase58(), " auth =", authPda.toBase58()); });

program.command("transfer").requiredOption("--from <OWNER>").requiredOption("--to <OWNER>").requiredOption("--amount <RAW>").action(async(o)=>{
  const { cfg }=load(); const prog=client(); const mint=new PublicKey(cfg.mint); const fromOwner=new PublicKey(o.from); const toOwner=new PublicKey(o.to); const devWallet=new PublicKey(cfg.devWallet);
  const conn=provider().connection; const payer=provider().wallet.publicKey; const ata=async(own)=> await getAssociatedTokenAddress(mint, own, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const [fromAta,toAta,devAta]=await Promise.all([ata(fromOwner),ata(toOwner),ata(devWallet)]);
  async function ensure(owner,ataPk){ const info=await conn.getAccountInfo(ataPk); if(!info){ const ix=createAssociatedTokenAccountInstruction(payer, ataPk, owner, mint, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID); await provider().sendAndConfirm({instructions:[ix]}); } }
  await ensure(fromOwner,fromAta); await ensure(toOwner,toAta); await ensure(devWallet,devAta);
  const [configPda]=PublicKey.findProgramAddressSync([Buffer.from("config")], prog.programId);
  const cfgAcc=await prog.account.globalConfig.fetch(configPda); const nextId=BigInt((Number(cfgAcc.currentEpochStart)/Number(cfgAcc.epochLength))+1); const seed=Buffer.alloc(8); seed.writeBigUInt64LE(nextId);
  const [epochPda]=PublicKey.findProgramAddressSync([Buffer.from("epoch"), seed], prog.programId);
  const tx=await prog.methods.programTransfer(new BN(o.amount)).accounts({config:configPda,mint,fromToken:fromAta,toToken:toAta,devToken:devAta,reflectionVault:new PublicKey(cfg.reflectionVault),holdPoolVault:new PublicKey(cfg.holdPoolVault),tokenProgram:TOKEN_2022_PROGRAM_ID,signer:provider().wallet.publicKey,systemProgram:SystemProgram.programId}).remainingAccounts([{pubkey:epochPda,isWritable:true,isSigner:false}]).rpc();
  console.log("tx:", tx);
});

program.parseAsync(process.argv);
