"use client";

import { useState } from "react";

export function CopyLinkButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
      onClick={copyLink}
      type="button"
    >
      {copied ? "Copiato" : "Copia link"}
    </button>
  );
}
