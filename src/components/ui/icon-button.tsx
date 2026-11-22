"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** A button that shows only an icon; `label` is its tooltip and its accessible name. */
export function IconButton({
  label,
  showLabel = false,
  children,
  variant = "ghost",
  size = "icon",
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label"> & {
  label: string;
  showLabel?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={variant}
            size={showLabel ? "default" : size}
            aria-label={label}
            {...props}
          />
        }
      >
        {children}
        {showLabel && <span>{label}</span>}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
