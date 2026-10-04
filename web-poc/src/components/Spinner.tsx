/** The loading ring shown inside a busy button. Takes the button's text colour. */
export function Spinner({ className = "size-[1.125rem]" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`spinner inline-block rounded-full border-[2.5px] border-current border-r-transparent ${className}`}
      style={{ animation: "spin 0.7s linear infinite" }}
    />
  );
}
