import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-cyber-neon-cyan text-cyber-bg-dark hover:bg-cyber-neon-cyan/90 shadow-neon-cyan",
        destructive:
          "bg-cyber-neon-red text-white hover:bg-cyber-neon-red/90 shadow-neon-red",
        outline:
          "border border-cyber-border bg-transparent hover:bg-cyber-bg-elevated hover:border-cyber-neon-cyan/50 hover:text-cyber-neon-cyan",
        secondary:
          "bg-cyber-bg-elevated text-cyber-text-primary hover:bg-cyber-bg-card border border-cyber-border",
        ghost:
          "hover:bg-cyber-bg-elevated hover:text-cyber-neon-cyan",
        link: "text-cyber-neon-cyan underline-offset-4 hover:underline",
        neon:
          "bg-transparent border-2 border-cyber-neon-cyan text-cyber-neon-cyan hover:bg-cyber-neon-cyan/10 hover:shadow-neon-cyan transition-all duration-300",
        "neon-red":
          "bg-transparent border-2 border-cyber-neon-red text-cyber-neon-red hover:bg-cyber-neon-red/10 hover:shadow-neon-red transition-all duration-300",
        "neon-green":
          "bg-transparent border-2 border-cyber-neon-green text-cyber-neon-green hover:bg-cyber-neon-green/10 hover:shadow-neon-green transition-all duration-300",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
