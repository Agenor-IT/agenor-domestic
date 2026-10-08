import React from 'react';
import { Search, X, Filter } from 'lucide-react';

interface TableSearchFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: { label: string; value: string }[];
  placeholder?: string;
  extraControls?: React.ReactNode;
}

export const TableSearchFilter: React.FC<TableSearchFilterProps> = ({
  searchTerm,
  onSearchChange,
  filterValue,
  onFilterChange,
  filterOptions,
  placeholder = 'Buscar en la tabla...',
  extraControls
}) => {
  return (
    <div className="p-4 bg-gray-50/70 dark:bg-[#1E293B]/60 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-9 pr-9 py-2 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 focus:border-[#0088FF] transition-all shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {filterOptions && onFilterChange && (
          <div className="relative shrink-0">
            <select
              value={filterValue || ''}
              onChange={(e) => onFilterChange(e.target.value)}
              className="pl-8 pr-4 py-2 text-xs font-semibold border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#0F172A] text-gray-800 dark:text-gray-200 appearance-none focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 shadow-sm cursor-pointer"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {extraControls && (
        <div className="flex items-center gap-2 shrink-0">
          {extraControls}
        </div>
      )}
    </div>
  );
};
