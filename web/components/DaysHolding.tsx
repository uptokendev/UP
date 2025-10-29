// web/components/DaysHolding.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { PublicKey, Connection, ParsedTransactionWithMeta } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { deriveAta } from "../lib/ata";

type Props = {
  mintAddress: string;       // Your $UP mint
  endpoint?: string;         // Optional custom RPC
  className?: string;
};

export default function DaysHolding({ mintAddress, endpoint, className }: Props) {
  const { publicKey } = useWallet();
  const [days, setDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const conn = useMemo(
    () => new Connection(endpoint || (process.env.NEXT_PUBLIC_RPC_ENDPOINT as string) || "https://api.mainnet-beta.solana.com", "confirmed"),
    [endpoint]
  );

  useEffect(() => {
    (async () => {
      setErr(null);
      setDays(null);
      if (!publicKey) return;

      setLoading(true);
      try {
        const mint = new PublicKey(mintAddress);
        const ata = deriveAta(publicKey, mint);

        // Quick check: do they hold anything?
        const balance = await conn.getTokenAccountBalance(ata).catch(() => null);
        if (!balance || Number(balance.value.amount) === 0) {
          setDays(0);
          setLoading(false);
          return;
        }

        // Walk recent history to find last time balance went from 0 -> >0
        const sigs = await conn.getSignaturesForAddress(ata, { limit: 1000 }, "confirmed");
        if (sigs.length === 0) { setDays(0); setLoading(false); return; }

        // Fetch in chronological order (oldest -> newest)
        const chronological = [...sigs].reverse();
        let startTs = 0;
        let lastKnownAmount = Number(balance.value.amount);

        // We scan backwards while tracking effective balance diffs.
        // On devnet/low activity accounts 1000 is plenty; increase if needed.
        for (let i = chronological.length - 1; i >= 0; i--) {
          const sig = chronological[i];
          const tx = await conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
          if (!tx) continue;

          // Find token balance change for this ATA in this tx
          const pre = tokenAmountForAccount(tx, ata.toBase58(), "pre");
          const post = tokenAmountForAccount(tx, ata.toBase58(), "post");
          if (pre == null || post == null) continue;

          // If we detect a transition 0 -> >0, mark this as start of current holding streak
          if (pre === 0 && post > 0) {
            startTs = tx.blockTime ?? 0;
            break;
          }

          // If they ever hit zero after this point, we stop searching because the current streak starts after.
          if (post === 0 && lastKnownAmount > 0) {
            // Current streak began after this tx, so the next inbound will set startTs.
            // Keep looping to find it.
            lastKnownAmount = 0;
          }
        }

        // Fallback: if we never saw a 0->>0 edge, use the oldest tx time we have
        if (!startTs) {
          const oldest = chronological[0];
          if (oldest?.blockTime) startTs = oldest.blockTime;
        }

        if (!startTs) { setDays(null); setErr("No timestamp found"); setLoading(false); return; }

        const nowSec = Math.floor(Date.now() / 1000);
        const diffDays = Math.max(0, Math.floor((nowSec - startTs) / 86400));
        setDays(diffDays);
      } catch (e: any) {
        setErr(e?.message || "Failed to calculate");
      } finally {
        setLoading(false);
      }
    })();
  }, [publicKey, mintAddress, conn]);

  if (!publicKey) return null;

  return (
    <div className={className ?? ""} title="Continuous holding streak (days)">
      <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
        <span className="h-2 w-2 rounded-full animate-pulse bg-white/70" />
        <span className="text-sm text-white/80">Holding streak</span>
        <strong className="text-base">{loading ? "…" : days ?? "—"}</strong>
        <span className="text-sm text-white/60">days</span>
      </div>
      {err && <div className="mt-1 text-xs text-red-400/80">{err}</div>}
    </div>
  );
}

function tokenAmountForAccount(
  tx: ParsedTransactionWithMeta,
  account: string,
  phase: "pre" | "post"
): number | null {
  const bal = tx?.meta?.[phase === "pre" ? "preTokenBalances" : "postTokenBalances"];
  if (!bal) return null;
  const entry = bal.find((b) => b.owner && b.uiTokenAmount && b.accountIndex != null && b.accountIndex >= 0 && (b.mint || "") !== "" && (b.owner || "") !== "");
  // Better: locate by account index using meta, but many RPCs omit ATA keys in an easy way.
  // We fallback to matching by owner+mint signature through balance arrays.
  const match = bal.find((b) => b?.owner && b?.uiTokenAmount && (b as any).account === account);
  const x = (match || entry)?.uiTokenAmount?.amount;
  return x != null ? Number(x) : null;
}
