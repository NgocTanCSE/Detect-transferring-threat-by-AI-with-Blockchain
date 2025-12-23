import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    glow?: "cyan" | "red" | "green" | "purple" | "orange" | "none";
  }
>(({ className, glow = "none", ...props }, ref) => {
  const glowClasses = {
    cyan: "border-cyber-neon-cyan/30 hover:border-cyber-neon-cyan/50 hover:shadow-neon-cyan",
    red: "border-cyber-neon-red/30 hover:border-cyber-neon-red/50 hover:shadow-neon-red",
    green: "border-cyber-neon-green/30 hover:border-cyber-neon-green/50 hover:shadow-neon-green",
    purple: "border-cyber-neon-purple/30 hover:border-cyber-neon-purple/50 hover:shadow-neon-purple",
    orange: "border-cyber-neon-orange/30 hover:border-cyber-neon-orange/50 hover:shadow-neon-orange",
    none: "border-cyber-border",
  };

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border bg-cyber-bg-card text-cyber-text-primary transition-all duration-300",
        glowClasses[glow],
        className
      )}
      {...props}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-cyber-text-secondary", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
