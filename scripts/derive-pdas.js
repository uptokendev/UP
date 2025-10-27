#!/usr/bin/env node
import { PublicKey } from '@solana/web3.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('program', { type: 'string', demandOption: true, describe: 'Program ID (declare_id!)' })
  .option('mint',    { type: 'string', demandOption: true, describe: 'Token-2022 mint address' })
  .option('wallet',  { type: 'string', describe: 'Optional holder wallet to derive [holder,...] PDA' })
  .option('epoch',   { type: 'number', describe: 'Optional epoch number to derive [epoch,<u64_le>]' })
  .strict()
  .help()
  .argv;

const programId = new PublicKey(argv.program);
const mint      = new PublicKey(argv.mint);

function u64ToLeBytes(n) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n));
  return buf;
}

function pda(seeds) {
  const [addr, bump] = PublicKey.findProgramAddressSync(seeds, programId);
  return { addr: addr.toBase58(), bump };
}

console.log('Program ID:        ', programId.toBase58());
console.log('Mint:              ', mint.toBase58());
console.log('---');

const config = pda([Buffer.from('config')]);
console.log('Config PDA:        ', config.addr, 'bump=', config.bump);

const vault = pda([Buffer.from('vault'), mint.toBuffer()]);
console.log('Vault Authority:   ', vault.addr,  'bump=', vault.bump);

if (argv.wallet) {
  const wallet = new PublicKey(argv.wallet);
  const holder = pda([Buffer.from('holder'), wallet.toBuffer()]);
  console.log('Holder PDA:        ', holder.addr, 'bump=', holder.bump, '(for wallet', wallet.toBase58() + ')');
}

if (typeof argv.epoch === 'number') {
  const epochSeed = u64ToLeBytes(argv.epoch);
  const epoch = pda([Buffer.from('epoch'), epochSeed]);
  console.log('Epoch PDA:         ', epoch.addr,  'bump=', epoch.bump, '(for epoch', argv.epoch + ')');
}

console.log('---');
console.log('Note: pass --wallet <PUBKEY> and/or --epoch <N> for additional PDAs.');
