"use client"

import { Button } from "@/components/ui/button"
import { Grid3X3, List } from "lucide-react"

interface ViewToggleProps {
  view: "grid" | "list"
  onViewChange: (view: "grid" | "list") => void
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="relative">
      {/* Фоновый градиент */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-100/30 to-blue-100/30 rounded-lg blur-sm"></div>

      <div className="relative flex bg-white/80 backdrop-blur-lg border border-cyan-200/50 rounded-lg overflow-hidden shadow-md shadow-cyan-100/20">
      <Button
        variant={view === "grid" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("grid")}
        className={
            view === "grid"
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 border-0 shadow-sm"
              : "text-cyan-700 hover:bg-cyan-100/50 border-0 bg-transparent"
        }
      >
        <Grid3X3 className="w-4 h-4" />
      </Button>
      <Button
        variant={view === "list" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("list")}
        className={
            view === "list"
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 border-0 shadow-sm"
              : "text-cyan-700 hover:bg-cyan-100/50 border-0 bg-transparent"
        }
      >
        <List className="w-4 h-4" />
      </Button>
      </div>
    </div>
  )
}
