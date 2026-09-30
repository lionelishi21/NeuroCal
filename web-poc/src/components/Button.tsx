import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "quiet" | "text";

const styles: Record<Variant, string> = {
  primary:
    "bg-synapse text-on-accent rounded-pill px-6 py-3.5 font-semibold shadow-action hover:brightness-110 active:brightness-95",
  quiet: "bg-paper text-ink rounded-pill px-5 py-3.5 font-semibold ring-1 ring-rule ring-inset hover:ring-ink-soft",
  text: "text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink px-1 py-1",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(
  function Button({ variant = "primary", className = "", type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex items-center justify-center gap-2 text-base transition-[filter,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
        {...props}
      />
    );
  },
);
