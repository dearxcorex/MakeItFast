"use client";

import { useState } from "react";

/**
 * Shows a handover password with a copy button. The value is deliberately
 * rendered in full: it exists only for the seconds between generation and
 * handover, and is never retrievable again once this modal closes.
 */
export function CopyablePassword({ value }: { value: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      // Clipboard is unavailable over plain http on some browsers. Say so: a
      // silent no-op is indistinguishable from a successful copy, and an admin
      // who believes they hold the password will paste whatever was on the
      // clipboard before and then dismiss the only screen showing the real one.
      setState("failed");
    }
  }

  return (
    <div className="space-y-1">
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
          {state === "copied" ? "Copied" : "Copy"}
        </button>
      </div>
      {state === "failed" && (
        <p role="alert" data-testid="copy-failed" className="text-xs text-red-400">
          Couldn&apos;t copy automatically — select the password above and copy
          it by hand.
        </p>
      )}
    </div>
  );
}
