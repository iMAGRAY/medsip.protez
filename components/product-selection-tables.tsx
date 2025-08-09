import React, { useState, useEffect } from 'react';

interface SelectionTablesProps {
  productSku: string;
  className?: string;
}

interface TableData {
  title: string;
  headers: string[];
  rows: string[][];
}

interface ProductSelectionData {
  [key: string]: TableData;
}

const SelectionTables: React.FC<SelectionTablesProps> = ({ productSku, className = '' }) => {
  const [tableData, setTableData] = useState<ProductSelectionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Extract product ID from productSku if it contains one
  const extractProductId = (sku: string): number | null => {
    // Try to extract product ID from various formats
    const idMatch = sku.match(/(?:id:|product_id:)(\d+)/i);
    if (idMatch) {
      return parseInt(idMatch[1]);
    }
    return null;
  };

  // Load selection tables from database only
  useEffect(() => {
    const loadSelectionTables = async () => {
      setIsLoading(true);

      try {
        const productId = extractProductId(productSku);

        if (productId) {

          const response = await fetch(`/api/products/${productId}/selection-tables`);

          if (response.ok) {
            const data = await response.json();
            if (data.success && Object.keys(data.data).length > 0) {

              setTableData(data.data);
            } else {

              setTableData(null);
            }
          } else {

            setTableData(null);
          }
        } else {

          setTableData(null);
        }
      } catch (error) {
        console.error('❌ Error loading selection tables:', error);
        setTableData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadSelectionTables();
  }, [productSku]);

  if (isLoading) {
    return (
      <div className={`selection-tables ${className}`}>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Таблицы</h2>
          </div>
          <div className="p-6">
          <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
              <span className="ml-3 text-gray-600">Загрузка таблиц...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render anything if no tables are available
  if (!tableData || Object.keys(tableData).length === 0) {
    return null;
  }

  const renderTable = (table: TableData) => (
    <div className="mb-8 last:mb-0">
      <h4 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
        {table.title}
      </h4>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-200 bg-white rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              {table.headers.map((header, index) => (
                <th
                  key={index}
                  className={`px-4 py-3 text-sm font-semibold text-gray-900 border-r border-gray-200 last:border-r-0 ${
                    index === 0 ? 'text-left' : 'text-center'
                  }`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`border-b border-gray-200 last:border-b-0 ${
                  rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                } hover:bg-gray-50 transition-colors duration-200`}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-4 py-3 text-sm border-r border-gray-200 last:border-r-0 ${
                      cellIndex === 0
                        ? 'font-semibold text-gray-900 bg-gray-50/80'
                        : 'text-center text-gray-700'
                    }`}
                  >
                    {cell === '+' ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full text-xs font-bold">
                        ✓
                      </span>
                    ) : cell === '—' ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-500 rounded-full text-xs font-bold">
                        ✗
                      </span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className={`selection-tables ${className}`}>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Таблицы</h2>
          </div>

        <div className="p-6 space-y-8">
        {/* Render all tables dynamically */}
        {Object.entries(tableData).map(([key, table]) => (
          <div key={key}>
            {renderTable(table)}
          </div>
        ))}

        </div>
      </div>
    </div>
  );
};

export default SelectionTables;