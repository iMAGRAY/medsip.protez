import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-normal transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300",
  {
    variants: {
      variant: {
        default: "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100",
        secondary: "border-gray-200 bg-white text-gray-500 hover:bg-gray-50",
        destructive: "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200",
        outline: "border-gray-200 text-gray-600 hover:bg-gray-50",
        success: "border-green-200 bg-green-50 text-green-600 hover:bg-green-100",
        warning: "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100",
        info: "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
