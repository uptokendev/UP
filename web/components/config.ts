// web/components/config.ts
export const LINKS = {
  docs: process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.up.meme",
  landing: process.env.NEXT_PUBLIC_LANDING_URL || "https://up.meme",
  twitter: process.env.NEXT_PUBLIC_TWITTER_URL || "https://twitter.com/upmeme",
  tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL || "https://tiktok.com/@upmeme",
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://instagram.com/upmeme",
  discord: process.env.NEXT_PUBLIC_DISCORD_URL || "https://discord.gg/xxxxx",
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/upmeme",
};

export const ADMIN_WALLETS = new Set(
  (process.env.NEXT_PUBLIC_ADMIN_WALLETS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);
