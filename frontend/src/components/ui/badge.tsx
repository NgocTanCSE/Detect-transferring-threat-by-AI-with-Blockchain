import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-cyber-neon-cyan/20 text-cyber-neon-cyan border-cyber-neon-cyan/50",
        secondary:
          "border-transparent bg-cyber-bg-elevated text-cyber-text-secondary border-cyber-border",
        destructive:
          "border-transparent bg-cyber-neon-red/20 text-cyber-neon-red border-cyber-neon-red/50",
        success:
          "border-transparent bg-cyber-neon-green/20 text-cyber-neon-green border-cyber-neon-green/50",
        warning:
          "border-transparent bg-cyber-neon-orange/20 text-cyber-neon-orange border-cyber-neon-orange/50",
        info:
          "border-transparent bg-cyber-neon-blue/20 text-cyber-neon-blue border-cyber-neon-blue/50",
        outline: "text-cyber-text-primary border-cyber-border",
        // Risk level badges
        critical:
          "border-transparent bg-cyber-neon-red/20 text-cyber-neon-red border-cyber-neon-red/50 animate-pulse",
        high:
          "border-transparent bg-cyber-neon-orange/20 text-cyber-neon-orange border-cyber-neon-orange/50",
        medium:
          "border-transparent bg-cyber-neon-yellow/20 text-cyber-neon-yellow border-cyber-neon-yellow/50",
        low:
          "border-transparent bg-cyber-neon-green/20 text-cyber-neon-green border-cyber-neon-green/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
