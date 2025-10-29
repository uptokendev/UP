// web/components/AdminOnly.tsx
"use client";
import { ReactNode, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ADMIN_WALLETS } from "./config";

export default function AdminOnly({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const isAdmin = useMemo(() => {
    if (!publicKey) return false;
    return ADMIN_WALLETS.has(publicKey.toBase58());
  }, [publicKey]);
  if (!isAdmin) return null;
  return <>{children}</>;
}
