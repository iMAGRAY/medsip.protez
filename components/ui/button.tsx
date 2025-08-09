import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-normal transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none touch-manipulation active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm",
        destructive: "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200",
        outline: "border border-gray-200 bg-white hover:bg-gray-50 text-gray-700",
        secondary: "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200",
        ghost: "text-gray-600 hover:bg-gray-50 hover:text-gray-700",
        link: "text-gray-600 underline-offset-4 hover:underline hover:text-gray-700",
        primary: "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200",
        success: "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-lg px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
