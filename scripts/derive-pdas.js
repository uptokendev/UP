#!/usr/bin/env node
import { PublicKey } from "@solana/web3.js";
import { Command } from "commander";

const program = new Command();
program.requiredOption("--program <PROGRAM_ID>").requiredOption("--mint <MINT>");
program.parse(process.argv);
const { program: pid, mint } = program.opts();

const PROGRAM_ID = new PublicKey(pid);
const MINT = new PublicKey(mint);

const [CONFIG_PDA] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
const [AUTH_PDA] = PublicKey.findProgramAddressSync([Buffer.from("auth")], PROGRAM_ID);
const [VAULT_AUTH] = PublicKey.findProgramAddressSync([Buffer.from("vault"), MINT.toBuffer()], PROGRAM_ID);

console.log("CONFIG_PDA  :", CONFIG_PDA.toBase58());
console.log("AUTH_PDA    :", AUTH_PDA.toBase58());
console.log("VAULT_AUTH  :", VAULT_AUTH.toBase58());
