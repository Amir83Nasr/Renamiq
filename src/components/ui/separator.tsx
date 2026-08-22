import * as React from "react";
import { cn } from "@/lib/utils";

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", ...props }, ref) => (
    // biome-ignore lint/a11y/useFocusableInteractive: divider is not interactive by design
    // biome-ignore lint/a11y/useSemanticElements: shadcn separator keeps div for className styling
    <div
      ref={ref}
      // biome-ignore lint/a11y/useAriaPropsForRole: separator needs no aria-valuenow, orientation given below
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  ),
);
Separator.displayName = "Separator";

export { Separator };
