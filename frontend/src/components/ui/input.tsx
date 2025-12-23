import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-cyber-border bg-cyber-bg-card px-3 py-2 text-sm text-cyber-text-primary ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-cyber-text-primary placeholder:text-cyber-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-neon-cyan/50 focus-visible:border-cyber-neon-cyan/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
