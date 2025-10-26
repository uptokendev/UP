# $UP — Complete Plain‑English Install (Devnet)

> Goal: Get your Token‑2022 $UP live on **devnet**, with UI sending (fees apply) and optional **Hook Enforcement** to block raw wallet sends.

---

## 0) Prereqs (once on your machine)
- Node 18+ and npm
- Rust + Anchor CLI
- Solana CLI
- SPL CLI (`cargo install spl-token-cli` if needed)

```bash
solana --version
anchor --version
node -v
npm -v
```

---

## 1) Create a devnet wallet and get 2 SOL
```bash
solana-keygen new --outfile ~/.config/solana/id.json
solana config set --url https://api.devnet.solana.com
solana config set --keypair ~/.config/solana/id.json
solana airdrop 2
solana balance
```

---

## 2) Build & deploy the $UP program
From the repo root (where `Anchor.toml` is):
```bash
anchor build
anchor deploy
```
Copy the printed **Program ID**. We’ll call this `PROGRAM_ID`.

---

## 3) Create the Token‑2022 mint with your program as the Transfer Hook
Set the program id and run the helper:
```bash
export HOOK_PROGRAM_ID=<PROGRAM_ID>
./scripts/create-token22-with-hook.sh
```
The script prints your **MINT** address. Save it.

---

## 4) Derive the PDAs (addresses we need)
This prints the **config**, **auth**, and **vault authority** PDAs:
```bash
node scripts/derive-pdas.js --program <PROGRAM_ID> --mint <MINT>
```
Keep these handy:
- `CONFIG_PDA` (seed: `config`)
- `AUTH_PDA`   (seed: `auth`)
- `VAULT_AUTH` (seed: `vault`, + mint)

---

## 5) Create the two vault token accounts (owner must be the vault PDA)
We need 2 token accounts owned by `VAULT_AUTH`:
- **Reflection vault** (holds the 1% reflection fee)
- **Hold pool vault** (holds the 0.5% weekly pool)

```bash
# Token-2022 program id (constant)
TOKEN22=TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# Create Reflection vault (owner = VAULT_AUTH)
spl-token --program-id $TOKEN22 create-account <MINT> --owner <VAULT_AUTH>

# Create Hold Pool vault (owner = VAULT_AUTH)
spl-token --program-id $TOKEN22 create-account <MINT> --owner <VAULT_AUTH>
```
Note the two new **token account** addresses: `REFLECTION_VAULT` and `HOLD_POOL_VAULT`.

---

## 6) Initialize program config (optional) & set CLI config
> The program ships with an `initialize` instruction, but for basic devnet testing you can configure via the CLI config file and call methods directly.

Set the CLI config:
```bash
cd cli
npm install
./index.js config   --program <PROGRAM_ID>   --mint <MINT>   --dev <YOUR_DEV_WALLET_PUBKEY>   --refl <REFLECTION_VAULT>   --pool <HOLD_POOL_VAULT>
```
This creates `cli/config.json` that the CLI uses for transfers.

---

## 7) Run the Web UI locally
Copy the IDL, set env, and start:
```bash
npm --prefix web run copy-idl
cd web && cp .env.local.example .env.local
# Edit .env.local to set:
# NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
# NEXT_PUBLIC_PROGRAM_ID=<PROGRAM_ID>
# NEXT_PUBLIC_MINT=<MINT>
# NEXT_PUBLIC_DEV_WALLET=<YOUR_DEV_WALLET_PUBKEY>
# NEXT_PUBLIC_REFLECTION_VAULT=<REFLECTION_VAULT>
# NEXT_PUBLIC_HOLD_POOL_VAULT=<HOLD_POOL_VAULT>

npm install
npm run dev
```
Open the site, connect your wallet, and use **Send via Program** to transfer $UP (fees apply).

---

## 8) Optional — Turn ON Hook Enforcement (blocks wallet “Send”)
When ON, raw wallet sends are blocked unless transactions include two small “ID cards” (the PDAs). Your UI/CLI work; normal wallet “Send” fails.

```bash
cd cli
./index.js set-hook-mode --enforce true
```
**One-time per mint**, register the **extra accounts** for the Transfer Hook so the hook receives them automatically:
- Fixed Meta #1: `CONFIG_PDA`
- Fixed Meta #2: `AUTH_PDA`

> The exact command depends on the SPL Hook tooling you use. If you don’t have a tool, keep enforcement OFF while testing; we can add a helper later.

---

## 9) Test transfers (CLI)
```bash
./index.js transfer --from <YOUR_PUBKEY> --to <RECIPIENT_PUBKEY> --amount <RAW_UNITS>
```
Tip: RAW units = UI amount × 10^decimals (the web UI does this automatically).

---

## 10) Deploy the UI to Netlify
- Base dir: `web`
- Build: `npm run build`
- Publish: `.next`
- Set env vars:
  - `NEXT_PUBLIC_RPC_URL`
  - `NEXT_PUBLIC_PROGRAM_ID`
  - `NEXT_PUBLIC_MINT`
  - `NEXT_PUBLIC_DEV_WALLET`
  - `NEXT_PUBLIC_REFLECTION_VAULT`
  - `NEXT_PUBLIC_HOLD_POOL_VAULT`

That’s it. You can start with enforcement **OFF** to keep testing easy, then flip it **ON** for fairness once you’re ready.
