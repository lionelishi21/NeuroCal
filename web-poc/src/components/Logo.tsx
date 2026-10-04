/**
 * The NeuroCal mark: an open ring, read as a "C" for Cal and as the Focus Score
 * ring, with a spark in its opening (a synapse firing). Colours come from the tokens, so it follows light and dark.
 */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <path
        d="M47.28 47.83 A22 22 0 1 1 47.28 16.17"
        fill="none"
        stroke="var(--synapse)"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      <circle cx="54" cy="32" r="4.8" fill="var(--ion)" />
    </svg>
  );
}

/** Mark plus the name, for headers. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-lg font-extrabold tracking-[-0.02em] text-ink ${className}`}>
      <LogoMark className="size-7" />
      NeuroCal
    </span>
  );
}
