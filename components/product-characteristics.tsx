import React from 'react'
import { Star, Layers, Package } from 'lucide-react'

interface Characteristic {
  value_id: number
  value_name: string
  additional_value?: string
  color_hex?: string
  created_at?: string
  updated_at?: string
}

interface CharacteristicGroup {
  group_id: number
  group_name: string
  group_ordering?: number
  show_in_main_params?: boolean
  main_params_priority?: number
  main_params_label_override?: string
  characteristics: Characteristic[]
}

interface CharacteristicSection {
  section_id: number
  section_name: string
  section_ordering?: number
  section_description?: string
  groups: CharacteristicGroup[]
}

interface ProductCharacteristicsProps {
  sections: CharacteristicSection[]
  hideMainParams?: boolean
  showTableFormat?: boolean
}

export default function ProductCharacteristics({
  sections,
  hideMainParams = false,
  showTableFormat = true
}: ProductCharacteristicsProps) {

  // Debug output

  if (!sections || sections.length === 0) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-cyan-200/30 p-8 shadow-sm text-center">
        <h2 className="text-xl font-semibold mb-3 bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">
          Характеристики
        </h2>
        <p className="text-slate-600">
          Характеристики не указаны.
        </p>
      </div>
    )
  }

  // Separate groups into main parameters and detailed characteristics across all sections
  const allGroups = sections.flatMap(section => section.groups);

  const mainParamsGroups = allGroups
    .filter(group => group.show_in_main_params === true)
    .sort((a, b) => {
      const priorityA = a.main_params_priority || 999;
      const priorityB = b.main_params_priority || 999;
      return priorityA - priorityB;
    });

  const detailedSections = sections
    .map(section => ({
      ...section,
      groups: section.groups.filter(group => group.show_in_main_params !== true)
    }))
    .filter(section => section.groups.length > 0)
    .sort((a, b) => {
      const orderingA = a.section_ordering || 999;
      const orderingB = b.section_ordering || 999;
      return orderingA - orderingB;
    });

  const formatValue = (ch: Characteristic): string => {
    // Основное значение - название характеристики
    let value = ch.value_name || '';

    // Если есть дополнительное значение, добавляем его
    if (ch.additional_value && ch.additional_value.trim()) {
      value += ` (${ch.additional_value.trim()})`;
    }

    return value.trim() || 'Не указано';
  };

  const getValueDisplayIcon = (ch: Characteristic, _value: string) => {
    // Цветовой индикатор для характеристик с цветом
    if (ch.color_hex && ch.color_hex.trim()) {
      return (
        <div
          className="w-3 h-3 rounded-full border border-slate-300 mr-2 flex-shrink-0"
          style={{ backgroundColor: ch.color_hex }}
          title={`Цвет: ${ch.color_hex}`}
        />
      );
    }

    return null;
  };

  const isImportantValue = (value: string): boolean => {
    const importantKeywords = ['да', 'есть', 'включен', 'поддерживается', 'активен'];
    return importantKeywords.some(keyword =>
      value.toLowerCase().includes(keyword)
    );
  };

  // Helper function to create table format for characteristics
  const renderCharacteristicsTable = (characteristics: Characteristic[], groupName: string) => {
    if (characteristics.length === 0) return null;

    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100/80 px-6 py-4 border-b border-slate-200/50">
          <h4 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-slate-600" />
            {groupName}
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody className="divide-y divide-slate-200/50">
              {characteristics.map((ch, index) => {
                const value = formatValue(ch);
                const valueIcon = getValueDisplayIcon(ch, value);
                const isImportant = isImportantValue(value);

                return (
                  <tr key={ch.value_id} className={`${index % 2 === 0 ? 'bg-white/60' : 'bg-slate-50/30'} hover:bg-slate-50/60 transition-colors duration-200`}>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700 border-r border-slate-200/30 w-1/3">
                      {ch.value_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      <div className="flex items-center">
                        {valueIcon}
                        <span className={`font-medium ${isImportant ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {ch.additional_value || 'Да'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Main parameters */}
      {!hideMainParams && mainParamsGroups.length > 0 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2 bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent flex items-center justify-center gap-2">
              <Star className="w-5 h-5 text-emerald-600" />
              Общие параметры
            </h2>
            <p className="text-sm text-slate-600">
              Ключевые характеристики изделия
            </p>
          </div>

          {/* Compact display of main parameters */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-emerald-200/40 p-6 shadow-lg shadow-emerald-100/20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mainParamsGroups.map((group) => {
                const displayName = group.main_params_label_override || group.group_name;

                return group.characteristics.map((ch) => {
                  const value = formatValue(ch);
                  const valueIcon = getValueDisplayIcon(ch, value);

                  return (
                    <div key={`${group.group_id}-${ch.value_id}`} className="bg-gradient-to-br from-emerald-50/80 to-teal-50/60 rounded-xl p-4 border border-emerald-200/30">
                      {/* Parameter name */}
                      <div className="text-sm font-semibold text-emerald-700 mb-2 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                        {displayName}
                      </div>

                      {/* Value */}
                      <div className="flex items-center">
                        {valueIcon}
                        <span className="text-base font-medium text-slate-800">
                          {value}
                        </span>
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
      )}

      {/* Detailed characteristics by sections */}
      {detailedSections.length > 0 && (
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2 bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">
              Подробные характеристики
            </h2>
            <p className="text-sm text-slate-600">
              Полная техническая информация и параметры устройства
            </p>
          </div>

          {/* Show sections with groups */}
          {detailedSections.map((section) => (
            <div key={section.section_id} className="space-y-6">
              {/* Section header */}
              <div className="border-b border-slate-200 pb-4">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <Layers className="w-6 h-6 text-cyan-600" />
                  {section.section_name}
                      </h3>
                {section.section_description && (
                  <p className="text-sm text-slate-600 mt-2">{section.section_description}</p>
                    )}
                <div className="text-xs text-slate-500 mt-1">
                  {section.groups.length} груп{section.groups.length === 1 ? 'па' : section.groups.length < 5 ? 'пы' : 'п'} характеристик
                  </div>
            </div>

              {/* Groups in section */}
              <div className="space-y-4">
                {section.groups
                  .sort((a, b) => (a.group_ordering || 999) - (b.group_ordering || 999))
                  .map((group) => {
                    if (showTableFormat) {
                      return renderCharacteristicsTable(group.characteristics, group.group_name);
                    } else {
                      // Card format for groups
                      return (
                <div key={group.group_id} className="bg-white/60 backdrop-blur-sm rounded-2xl border border-cyan-200/30 p-6 shadow-sm">
                  {/* Group header */}
                  <div className="pb-4 border-b border-cyan-200/30">
                            <h4 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
                              <Package className="w-5 h-5 text-cyan-600" />
                      {group.group_name}
                            </h4>
                    <p className="text-xs text-cyan-600">
                      {group.characteristics.length} параметр{group.characteristics.length !== 1 ? 'ов' : ''}
                    </p>
                  </div>

                  {/* Group characteristics */}
                  <div className="space-y-4 pt-4">
                    {group.characteristics.map((ch) => {
                              const value = formatValue(ch);
                              const valueIcon = getValueDisplayIcon(ch, value);
                              const isImportant = isImportantValue(value);

                      return (
                                <div key={ch.value_id} className="flex items-start justify-between group">
                          <div className="flex items-start gap-3 flex-1">
                            {valueIcon}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-700 mb-1">
                                        {ch.value_name}
                              </div>
                              <div className={`text-base font-semibold transition-colors ${
                                isImportant
                                  ? 'text-emerald-700'
                                  : 'text-slate-900'
                              }`}>
                                        {ch.additional_value || 'Да'}
                                      </div>
                                    </div>
                              </div>
                            </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    })}
                  </div>
                </div>
              ))}
        </div>
      )}
    </div>
  )
}