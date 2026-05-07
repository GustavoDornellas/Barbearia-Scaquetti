import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition",
        {
          "bg-gold text-[#1d1710] hover:bg-sand": variant === "primary",
          "border border-border bg-panelSoft text-text hover:border-gold/50": variant === "secondary",
          "bg-transparent text-muted hover:text-text": variant === "ghost"
        },
        className
      )}
      {...props}
    />
  );
}

