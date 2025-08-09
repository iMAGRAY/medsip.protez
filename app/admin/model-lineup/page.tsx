"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ModelLineupRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/admin/model-lines")
  }, [router])

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-lg">Перенаправление...</div>
    </div>
  )
}