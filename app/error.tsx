"use client"
import Link from 'next/link'

export default function Error({ error: _error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <h2 className="text-2xl font-bold text-slate-600">Произошла ошибка</h2>
      <p className="mt-2 text-sm text-slate-700">Мы уже работаем над её исправлением.</p>
      <div className="mt-4 flex gap-3">
        <button onClick={() => reset()} className="px-4 py-2 bg-teal-600 text-white rounded">
          Попробовать снова
        </button>
        <Link href="/" className="px-4 py-2 bg-slate-200 rounded">
          На главную
        </Link>
      </div>
    </div>
  )
}

