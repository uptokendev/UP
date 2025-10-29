"use client";
import React from "react";

export default function Hero({ children }: { children?: React.ReactNode }) {
  return (
    <section className="relative mx-auto mt-8 w-full max-w-6xl px-4">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(1200px_500px_at_20%_-10%,rgba(0,224,255,0.25),transparent),radial-gradient(1000px_400px_at_80%_0%,rgba(138,43,226,0.25),transparent)]" />
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-[1px]">
        <div className="rounded-2xl bg-[#0b0b14]/80 p-6 md:p-10">
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Launch. Hold.{" "}
            <span className="bg-gradient-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">
              Go UP.
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-white/70">
            A simple, fair, community-first launchpad and token experience.
          </p>
          {children}
        </div>
      </div>
    </section>
  );
}
