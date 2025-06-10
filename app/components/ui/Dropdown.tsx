/* eslint-disable react/display-name */
// your-dropdown-menu.jsx
import React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { CheckIcon, MoreHorizontal } from "lucide-react";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

interface DropdownMenuContentProps
  extends DropdownMenuPrimitive.DropdownMenuContentProps {
  children: React.ReactNode;
}

export const DropdownMenuContent = React.forwardRef(function (
  { children, ...props }: DropdownMenuContentProps,
  forwardedRef: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        {...props}
        ref={forwardedRef}
        className="max-w-72 shadow-black  w-full overflow-hidden translucent border border-zinc-900 rounded-md p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade"
        sideOffset={5}
      >
        {children}
        <DropdownMenuPrimitive.Arrow />
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
});

export const DropdownMenuLabel = DropdownMenuPrimitive.Label;

export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

interface DropdownMenuItemProps extends DropdownMenuPrimitive.MenuItemProps {
  children: React.ReactNode;
}

export const DropdownMenuItem = React.forwardRef(function DropdownMenuItem(
  { children, ...props }: DropdownMenuItemProps,
  forwardedRef: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <DropdownMenuPrimitive.Item
      {...props}
      ref={forwardedRef}
      className="group text-sm leading-none text-zinc-500 rounded flex items-center h-[25px] px-[5px] relative select-none outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-zinc-900"
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
});

interface DropdownMenuCheckboxItemProps
  extends DropdownMenuPrimitive.MenuCheckboxItemProps {
  checked: boolean | "indeterminate";
  children: React.ReactNode;
}

export const DropdownMenuCheckboxItem = React.forwardRef(
  function DropdownMenuCheckboxItem(
    { children, ...props }: DropdownMenuCheckboxItemProps,
    forwardedRef: React.ForwardedRef<HTMLDivElement>
  ) {
    return (
      <DropdownMenuPrimitive.CheckboxItem
        {...props}
        ref={forwardedRef}
        className="group text-sm leading-none text-zinc-500 rounded flex items-center h-[25px] px-[5px] relative select-none outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-zinc-900"
      >
        {children}
        <DropdownMenuPrimitive.ItemIndicator className="absolute left-0 w-[25px] inline-flex items-center justify-center">
          {props.checked === "indeterminate" && <MoreHorizontal />}
          {props.checked === true && <CheckIcon />}
        </DropdownMenuPrimitive.ItemIndicator>
      </DropdownMenuPrimitive.CheckboxItem>
    );
  }
);

export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

interface DropdownMenuRadioItemProps
  extends DropdownMenuPrimitive.MenuRadioItemProps {
  value: string;
  children: React.ReactNode;
}

export const DropdownMenuRadioItem = React.forwardRef(
  function DropdownMenuRadioItem(
    { children, value, ...props }: DropdownMenuRadioItemProps,
    forwardedRef: React.ForwardedRef<HTMLDivElement>
  ) {
    return (
      <DropdownMenuPrimitive.RadioItem
        className="text-sm leading-none text-zinc-500 rounded flex items-center h-[25px] px-[5px] relative select-none outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-zinc-900"
        value={value}
        {...props}
        ref={forwardedRef}
      >
        {children}
        <DropdownMenuPrimitive.ItemIndicator className="absolute left-0 w-[25px] inline-flex items-center justify-center">
          <CheckIcon />
        </DropdownMenuPrimitive.ItemIndicator>
      </DropdownMenuPrimitive.RadioItem>
    );
  }
);

export const DropdownMenuSeparator = DropdownMenuPrimitive.Separator;
