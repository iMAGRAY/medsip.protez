"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Phone, Mail, MapPin, Globe, Info } from "lucide-react"
import { AdditionalContact } from "@/lib/admin-data"

interface AdditionalContactsManagerProps {
  contacts: AdditionalContact[]
  onChange: (contacts: AdditionalContact[]) => void
}

const contactTypeIcons = {
  phone: Phone,
  email: Mail,
  address: MapPin,
  website: Globe,
  other: Info,
}

const contactTypeLabels = {
  phone: "Телефон",
  email: "Email",
  address: "Адрес",
  website: "Веб-сайт",
  other: "Другое",
}

export function AdditionalContactsManager({ contacts, onChange }: AdditionalContactsManagerProps) {
  const [newContact, setNewContact] = useState<Partial<AdditionalContact>>({
    type: "phone",
    label: "",
    value: "",
    isActive: true,
  });

  const addContact = () => {
    if (!newContact.label || !newContact.value) return;
    const contact: AdditionalContact = {
      id: Date.now().toString(),
      type: newContact.type as AdditionalContact["type"],
      label: newContact.label,
      value: newContact.value,
      isActive: newContact.isActive ?? true,
    };
    onChange([...contacts, contact]);
    setNewContact({ type: "phone", label: "", value: "", isActive: true });
  };

  const removeContact = (id: string) => {
    onChange(contacts.filter(contact => contact.id !== id));
  };

  const toggleContactStatus = (id: string) => {
    onChange(contacts.map(contact =>
      contact.id === id ? { ...contact, isActive: !contact.isActive } : contact
    ));
  };

  return (
    <div className="border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Дополнительная контактная информация</h3>
      <div className="space-y-6">
        {contacts.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-700">Текущие контакты</h4>
            {contacts.map((contact) => {
              const Icon = contactTypeIcons[contact.type];
              return (
                <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{contact.label}</span>
                        <span className={`px-2 py-1 text-xs rounded ${contact.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {contact.isActive ? "Активен" : "Неактивен"}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">{contact.value}</div>
                      <div className="text-xs text-slate-400">{contactTypeLabels[contact.type]}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleContactStatus(contact.id)}>
                      {contact.isActive ? "Скрыть" : "Показать"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => removeContact(contact.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
          <h4 className="text-sm font-medium text-slate-700">Добавить новый контакт</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-type">Тип контакта</Label>
              <select
                id="contact-type"
                value={newContact.type}
                onChange={(e) => setNewContact({ ...newContact, type: e.target.value as AdditionalContact["type"] })}
                className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
              >
                {Object.entries(contactTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-label">Название</Label>
              <Input
                id="contact-label"
                placeholder="Например: Горячая линия"
                value={newContact.label}
                onChange={(e) => setNewContact({ ...newContact, label: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-value">Значение</Label>
            <Input
              id="contact-value"
              placeholder={
                newContact.type === "phone" ? "+7 (xxx) xxx-xx-xx" :
                newContact.type === "email" ? "example@domain.com" :
                newContact.type === "address" ? "Адрес" :
                newContact.type === "website" ? "https://example.com" :
                "Значение"
              }
              value={newContact.value}
              onChange={(e) => setNewContact({ ...newContact, value: e.target.value })}
            />
          </div>
          <Button
            onClick={addContact}
            disabled={!newContact.label || !newContact.value}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить контакт
          </Button>
        </div>
      </div>
    </div>
  );
}