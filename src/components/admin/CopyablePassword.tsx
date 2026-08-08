"use client";

import { useState } from "react";

/**
 * Shows a handover password with a copy button. The value is deliberately
 * rendered in full: it exists only for the seconds between generation and
 * handover, and is never retrievable again once this modal closes.
 */
export function CopyablePassword({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is unavailable over plain http on some browsers; the text is
      // select-all so the admin can still copy it by hand.
      setCopied(false);
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <pre
        data-testid="handover-password"
        className="flex-1 rounded-md bg-black/40 p-3 font-mono text-sm select-all break-all"
      >
        {value}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="rounded-md border border-[var(--fo-divider)] px-3 text-xs shrink-0"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
