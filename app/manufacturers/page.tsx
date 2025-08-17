"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SafeImage } from "@/components/safe-image"

interface Manufacturer {
  id: number
  name: string
  description: string
  country: string
  logo_url: string | null
  website: string | null
}

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/manufacturers")
        const json = await res.json()
        if (json.success) {
          setManufacturers(json.data)
        }
      } catch (err) {
        console.error("Failed to load manufacturers", err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="container max-w-screen-lg mx-auto py-10 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Производители</h1>
      {isLoading && <p>Загрузка...</p>}
      {!isLoading && manufacturers.length === 0 && (
        <p>Производители не найдены.</p>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {manufacturers.map(m => (
          <Card key={m.id} className="overflow-hidden">
            {m.logo_url && (
              <SafeImage src={m.logo_url} alt={m.name} width={320} height={128} className="w-full h-32 object-contain p-4" />
            )}
            <CardHeader>
              <CardTitle>{m.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {m.country && <p className="text-sm text-slate-600">{m.country}</p>}
              {m.description && <p className="text-sm text-slate-700">{m.description}</p>}
              {m.website && (
                <Link href={m.website} className="text-teal-600 hover:text-teal-800 text-sm" target="_blank" rel="noopener noreferrer">
                  Сайт производителя
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

