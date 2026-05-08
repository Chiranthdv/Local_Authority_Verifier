import React from "react";

function Footer() {
  return (
    <footer className="relative mt-10 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="glass-panel relative overflow-hidden rounded-[var(--radius-2xl)] px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-caption">Trust Infrastructure</p>
              <p className="mt-2 font-display text-lg text-white">TrustLayer</p>
            </div>
            <p className="max-w-xl text-sm text-[var(--text-muted)]">
              Verified local hiring with cinematic transparency, faster trust signals, and calmer service discovery.
            </p>
            <p className="text-sm text-[var(--text-tertiary)]">Copyright 2026 TrustLayer</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
