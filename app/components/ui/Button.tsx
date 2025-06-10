import clsx from "clsx";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export const Button: React.FC<ButtonProps> = ({ ...props }: ButtonProps) => {
  return (
    <button
      {...props}
      className={clsx(
        "rounded-md border border-zinc-900 bg-gradient-to-b from-zinc-900/70 to-zinc-900/70 bg-[length:200%_200%] bg-bottom px-2 py-0.5 text-zinc-400 shadow-[inset_0_1px_1px_rgba(255,255,255,.16)] transition-all hover:bg-top active:bg-gradient-to-t"
      )}
    >
      {props.children}
    </button>
  );
};
