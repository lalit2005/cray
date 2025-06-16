import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef } from "react";

export interface DialogContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
}

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  function DialogContent(
    { title, description, children, ...props },
    forwardedRef
  ) {
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-zinc-900/30" />
        <DialogPrimitive.Content
          {...props}
          ref={forwardedRef}
          className="z-50 fixed top-[30%] left-[50%] max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] translucent shadow-2xl shadow-black p-[25px] focus:outline-none border border-zinc-800 backdrop-blur-md"
        >
          <DialogPrimitive.Title className="text-zinc-500 m-0 text-base font-medium">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-zinc-500 mt-[10px] mb-5 text-sm leading-normal">
            {description}
          </DialogPrimitive.Description>

          {children}
          <DialogPrimitive.Close
            aria-label="Close"
            className="text-zinc-500 hover:bg-zinc-900 p-1 focus:shadow-violet7 absolute top-[10px] right-[10px] inline-flex h-10 w-10 appearance-none items-center justify-center rounded-full focus:shadow-[0_0_0_2px] focus:outline-none"
          >
            <X />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  }
);

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
