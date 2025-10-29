"use client";
import Link from "next/link";
import { LINKS } from "./config";

const items = [
  { key: "docs", label: "Docs" },
  { key: "landing", label: "Website" },
  { key: "twitter", label: "Twitter" },
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "discord", label: "Discord" },
  { key: "telegram", label: "Telegram" },
] as const;

export default function SocialLinks() {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => {
        const href = (LINKS as any)[i.key] as string;
        if (!href) return null;
        return (
          <Link
            key={i.key}
            href={href}
            target="_blank"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10 transition"
          >
            {i.label}
          </Link>
        );
      })}
    </div>
  );
}
