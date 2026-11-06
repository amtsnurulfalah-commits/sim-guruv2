import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ui-action text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "ui-action-primary",
        destructive: "ui-action-destructive",
        solid: "ui-action-solid",
        outline: "ui-action-secondary",
      },
      size: {
        default: "min-h-11 px-4 py-2.5",
        sm: "min-h-11 px-3 py-2",
        lg: "min-h-12 px-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
function Button({
  className,
  variant,
  size,
  asChild = false,
  disabled,
  "aria-busy": busy,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      aria-busy={busy}
      disabled={asChild ? disabled : disabled || busy === true || busy === "true"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
export { Button, buttonVariants };
