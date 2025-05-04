import * as React from "react"
import { cn } from "@/lib/utils"

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, children, ...props }, ref) => {
  return (
    <tr
      ref={ref}
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  )
})
TableRow.displayName = "TableRow"

// Assuming the rest of the file structure might need adjustment 
// if this was part of a larger file initially.
// If this is a standalone file, this is complete. 