"use client"


interface CategoryGroup {
  id: number
  name: string
  parent_id: number | null
  level: number
  full_path: string
  is_active: boolean
  children?: CategoryGroup[]
}

interface CategorySidebarProps {
  hierarchicalCategories: CategoryGroup[]
  activeCategory: string
  activeCategoryId: number | null
  onCategoryChange: (category: string, categoryId?: number) => void
  HierarchicalCategoryItem: React.ComponentType<{ group: CategoryGroup }>
}

export function CategorySidebar({
  hierarchicalCategories,
  activeCategory,
  activeCategoryId,
  onCategoryChange,
  HierarchicalCategoryItem
}: CategorySidebarProps) {
  return (
    <>
      {/* Кнопка "Все категории" */}
      <div className="mb-4">
        <button
          onClick={() => onCategoryChange("All")}
          className={`
            w-full text-left px-4 py-3 rounded-lg transition-all duration-300 font-medium border
            ${
              activeCategory === "All" || activeCategoryId === null
                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-200/30 border-cyan-400"
                : "text-cyan-700 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 border-cyan-200/40 hover:border-cyan-300/60 hover:shadow-md"
            }
          `}
        >
          Все категории
        </button>
      </div>

      {/* Иерархические категории */}
      <div className="space-y-2">
        {hierarchicalCategories.map((group) => (
          <HierarchicalCategoryItem key={group.id} group={group} />
        ))}
      </div>

      {/* Информация внизу */}
      {hierarchicalCategories.length === 0 && (
        <div className="text-center py-8 text-cyan-600/70">
          <p className="text-sm font-medium">Меню каталога пустое</p>
          <p className="text-xs mt-2 text-cyan-500/60">Настройте его в админ панели</p>
        </div>
      )}

      {/* Удалено уведомление о настройке меню в админ-панели по просьбе пользователя */}
    </>
  )
}