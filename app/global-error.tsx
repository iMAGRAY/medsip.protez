'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <h2 className="text-2xl font-bold text-slate-600">Произошла глобальная ошибка</h2>
        <p className="mt-2 text-sm text-slate-700">Мы уже работаем над её исправлением.</p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
          >
            Попробовать снова
          </button>
          <a
            href="/"
            className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300"
          >
            На главную
          </a>
        </div>
      </body>
    </html>
  )
}