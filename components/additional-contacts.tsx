import { Phone, Mail, MapPin, Globe, Info } from "lucide-react"
import { AdditionalContact } from "@/lib/admin-data"

interface AdditionalContactsProps {
  contacts: AdditionalContact[]
  className?: string
  theme?: "light" | "dark"
}

const contactTypeIcons = {
  phone: Phone,
  email: Mail,
  address: MapPin,
  website: Globe,
  other: Info,
}

export function AdditionalContacts({ contacts, className = "", theme = "light" }: AdditionalContactsProps) {
  const activeContacts = contacts.filter(contact => contact.isActive)

  if (activeContacts.length === 0) {
    return null
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {activeContacts.map((contact) => {
        const Icon = contactTypeIcons[contact.type]
        const isLink = contact.type === "website" || contact.type === "email"
        const href = contact.type === "email" ? `mailto:${contact.value}` :
                    contact.type === "website" ? contact.value :
                    contact.type === "phone" ? `tel:${contact.value}` : undefined

        const content = (
          <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
            theme === "dark"
              ? "bg-teal-600/20 hover:bg-teal-500/30"
              : "bg-slate-50 hover:bg-slate-100"
          }`}>
            <Icon className={`w-5 h-5 flex-shrink-0 ${
              theme === "dark" ? "text-cyan-300" : "text-teal-600"
            }`} />
            <div>
              <div className={`font-medium ${
                theme === "dark" ? "text-white" : "text-slate-900"
              }`}>{contact.label}</div>
              <div className={`text-sm ${
                theme === "dark" ? "text-teal-100" : "text-slate-600"
              }`}>{contact.value}</div>
            </div>
          </div>
        )

        if (isLink && href) {
          return (
            <a
              key={contact.id}
              href={href}
              className="block hover:scale-[1.02] transition-transform"
              target={contact.type === "website" ? "_blank" : undefined}
              rel={contact.type === "website" ? "noopener noreferrer" : undefined}
            >
              {content}
            </a>
          )
        }

        return (
          <div key={contact.id} className="hover:scale-[1.02] transition-transform">
            {content}
          </div>
        )
      })}
    </div>
  )
}