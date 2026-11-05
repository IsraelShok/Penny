"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** A button that shows only an icon; `label` is its tooltip and its accessible name. */
export function IconButton({
  label,
  children,
  variant = "ghost",
  size = "icon",
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label"> & { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant={variant} size={size} aria-label={label} {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
