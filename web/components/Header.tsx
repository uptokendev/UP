"use client";
import Image from "next/image";
import SocialLinks from "./SocialLinks";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[rgba(11,11,20,.7)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Image src="/logo-up.png" alt="$UP" width={36} height={36}
            className="drop-shadow-[0_0_18px_rgba(120,0,255,.6)]" />
          <span className="text-white/90 font-semibold tracking-wide">UP</span>
        </div>
        <div className="hidden md:flex items-center gap-3">
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
