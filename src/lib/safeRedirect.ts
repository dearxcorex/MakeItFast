export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  // Mirror what a browser does before resolving a URL:
  //   - tab/newline/CR are stripped entirely ("/\t/evil.com" -> "//evil.com")
  //   - backslashes in the authority are treated as forward slashes
  // Normalize the same way before deciding if this is a safe same-origin path.
  const normalized = raw.replace(/[\t\n\r]/g, "").replace(/\\/g, "/");
  if (!normalized.startsWith("/")) return "/";
  // "//host" is protocol-relative — browsers resolve it to a full origin.
  if (normalized.startsWith("//")) return "/";
  return raw;
}
