"use client"

export default function AboutPage() {
  return (
    <div className="container max-w-screen-md mx-auto py-10 space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">О проекте</h1>
      <p className="text-slate-700">
        MedSIP Prosthetics System предоставляет инструменты для управления
        каталогом протезов и ортезов. Проект построен на Next.js и включает
        админ‑панель, REST API и систему хранения медиафайлов во внешнем S3.
      </p>
      <p className="text-slate-700">
        Исходный код доступен в этом репозитории. Для подробностей смотрите
        раздел <code>docs/</code>.
      </p>
    </div>
  )
}
