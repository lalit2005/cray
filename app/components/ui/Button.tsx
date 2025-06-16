import clsx from "clsx";
import { forwardRef } from "react";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        {...props}
        className={clsx(
          "focus:outline-none focus:ring-2 focus:ring-zinc-700 rounded-md border border-zinc-900 bg-gradient-to-b from-zinc-900/70 to-zinc-900/70 bg-[length:200%_200%] bg-bottom px-2 py-0.5 text-zinc-400 shadow-[inset_0_1px_1px_rgba(255,255,255,.16)] transition-all hover:bg-zinc-800/50 hover:text-zinc-300 hover:border-zinc-800 focus:bg-zinc-800/50 focus:text-zinc-300 focus:border-zinc-800",
          className
        )}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
