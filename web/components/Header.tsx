// web/components/Header.tsx
"use client";
import Image from "next/image";
import SocialLinks from "./SocialLinks";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 w-full border-b border-white/10 bg-[#0b0b14]/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Image src="/logo-up.png" alt="UP" width={36} height={36} className="drop-shadow-[0_0_10px_rgba(120,0,255,0.6)]" />
          <span className="font-semibold tracking-wide text-white/90">UP</span>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <SocialLinks />
          <WalletMultiButton />
        </div>
        <div className="md:hidden">
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
