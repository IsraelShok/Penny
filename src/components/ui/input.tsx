import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      // digits read left-to-right even in Hebrew; aligned to the RTL start edge
      dir={type === "number" ? "ltr" : undefined}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-base sm:text-sm shadow-none transition-colors outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground",
        "[&[type=number]]:[appearance:textfield] [&[type=number]::-webkit-inner-spin-button]:appearance-none [&[type=number]::-webkit-outer-spin-button]:appearance-none rtl:[&[type=number]]:text-right",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30",
        className,
      )}
      {...props}
    />
  );
}

interface InputGroupProps extends Omit<React.ComponentProps<"div">, "prefix"> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

function InputGroup({ className, prefix, suffix, children, ...props }: InputGroupProps) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "flex h-11 w-full min-w-0 items-stretch rounded-md border border-input bg-background text-sm transition-colors",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        "[&_input]:h-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-2 [&_input]:py-0 [&_input]:shadow-none [&_input]:focus-visible:ring-0 [&_input]:focus-visible:ring-offset-0",
        className,
      )}
      {...props}
    >
      {prefix && (
        <span className="flex items-center ps-3 pe-1 text-sm text-muted-foreground">{prefix}</span>
      )}
      {children}
      {suffix && (
        <span className="flex items-center ps-1 pe-3 text-sm text-muted-foreground">{suffix}</span>
      )}
    </div>
  );
}

export { Input, InputGroup };
