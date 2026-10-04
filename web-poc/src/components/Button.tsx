import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "quiet" | "soft" | "text";

const styles: Record<Variant, string> = {
  primary: "h-14 rounded-pill bg-synapse px-6 text-lg font-bold text-on-accent hover:brightness-110 active:brightness-95",
  quiet: "h-12 rounded-pill border-[1.5px] border-rule-strong px-5 text-sm font-bold text-synapse-ink hover:border-ink-soft",
  soft: "h-11 rounded-pill bg-synapse-soft px-4 text-sm font-bold text-synapse-ink hover:brightness-95",
  text: "px-1 py-1 text-md font-bold text-synapse-ink hover:underline hover:underline-offset-4",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(
  function Button({ variant = "primary", className = "", type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex cursor-pointer items-center justify-center gap-2 transition-[filter,opacity] duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${styles[variant]} ${className}`}
        {...props}
      />
    );
  },
);
