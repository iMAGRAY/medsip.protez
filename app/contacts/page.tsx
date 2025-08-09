"use client"
import { useAdminStore } from "@/lib/admin-store"
import { AdditionalContacts } from "@/components/additional-contacts"
import { Phone, Mail, MapPin } from "lucide-react"

export default function ContactsPage() {
  const { siteSettings } = useAdminStore()

  const phone =
    siteSettings?.contactPhone || process.env.NEXT_PUBLIC_CONTACT_PHONE || ''
  const email =
    siteSettings?.contactEmail || process.env.NEXT_PUBLIC_CONTACT_EMAIL || ''
  const address =
    siteSettings?.address || process.env.NEXT_PUBLIC_CONTACT_ADDRESS || ''

  return (
    <div className="container max-w-screen-md mx-auto py-10 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">Контакты</h1>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Phone className="w-5 h-5 text-teal-600" />
          <a href={`tel:${phone}`} className="text-teal-600 hover:text-teal-800">
            {phone}
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-teal-600" />
          <a href={`mailto:${email}`} className="text-teal-600 hover:text-teal-800">
            {email}
          </a>
        </div>
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-teal-600 mt-0.5" />
          <p className="text-slate-700 leading-relaxed">
            {address}
          </p>
        </div>
        {siteSettings?.additionalContacts && siteSettings.additionalContacts.length > 0 && (
          <div className="pt-6 border-t space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Дополнительные контакты</h2>
            <AdditionalContacts contacts={siteSettings.additionalContacts} className="space-y-2" theme="light" />
          </div>
        )}
      </div>
    </div>
  )
}
