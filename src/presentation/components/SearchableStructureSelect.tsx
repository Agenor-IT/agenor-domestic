import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useVoiceValue } from '../hooks/useVoiceValue';

export interface StructureOption {
  id: string;
  label: string;
  detail?: string;
  searchText?: string;
}

interface SearchableStructureSelectProps {
  id: string;
  value: string;
  options: StructureOption[];
  onChange: (id: string) => void;
  placeholder: string;
  emptyLabel: string;
  disabled?: boolean;
  accent: 'emerald' | 'rose';
}

const MAX_VISIBLE_OPTIONS = 30;

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es');

export const SearchableStructureSelect: React.FC<SearchableStructureSelectProps> = ({
  id,
  value,
  options,
  onChange,
  placeholder,
  emptyLabel,
  disabled = false,
  accent
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find(option => option.id === value);
  const freeOption = options.find(option => option.id === 'otro');
  const listId = `${id}-options`;

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return options.filter(option => option.id !== 'otro' && (!term || normalize(`${option.label} ${option.detail || ''} ${option.searchText || ''}`).includes(term)));
  }, [options, query]);
  const visibleRegular = filtered.slice(0, freeOption ? MAX_VISIBLE_OPTIONS - 1 : MAX_VISIBLE_OPTIONS);
  const visible = freeOption ? [...visibleRegular, freeOption] : visibleRegular;
  const highlightedIndex = Math.min(activeIndex, Math.max(visible.length - 1, 0));

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: Event) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [open]);

  const choose = (option: StructureOption) => {
    onChange(option.id);
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
  };

  useVoiceValue(inputRef, next => {
    const option = options.find(item => item.id === String(next));
    if (option && !disabled) choose(option);
  });

  return (
    <div ref={containerRef} className="min-w-0">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          data-voice-options={JSON.stringify(options.map(option => ({ value: option.id, label: `${option.label}${option.detail ? ` · ${option.detail}` : ''}` })))}
          data-voice-value={value}
          id={id}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && visible[highlightedIndex] ? `${id}-option-${highlightedIndex}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : selected?.label || ''}
          onFocus={() => { setQuery(''); setActiveIndex(0); setOpen(true); }}
          onChange={event => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
            if (value) onChange('');
          }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex(index => Math.min(index + 1, Math.max(visible.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex(index => Math.max(index - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (open && visible[highlightedIndex]) choose(visible[highlightedIndex]);
            } else if (event.key === 'Escape') {
              setOpen(false);
            } else if (event.key === 'Tab') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className={`w-full rounded-xl border bg-white py-2.5 pl-10 pr-3 font-bold text-gray-900 outline-none disabled:opacity-70 dark:bg-[#1E293B] dark:text-white ${accent === 'emerald' ? 'border-emerald-200 focus:ring-2 focus:ring-emerald-500 dark:border-emerald-900/40' : 'border-rose-200 focus:ring-2 focus:ring-rose-500 dark:border-rose-900/40'}`}
        />
      </div>
      {open && (
        <div id={listId} role="listbox" className="mt-1 max-h-56 overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-[#1E293B]">
          {visible.map((option, index) => (
            <button
              key={option.id}
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={option.id === value}
              onClick={() => choose(option)}
              className={`block w-full rounded-lg px-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${index === highlightedIndex ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
            >
              <span className="block break-words font-bold text-gray-900 dark:text-white">{option.label}</span>
              {option.detail && <span className="block break-words text-[11px] font-medium text-gray-500 dark:text-gray-400">{option.detail}</span>}
            </button>
          ))}
          {!filtered.length && <p className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{emptyLabel}</p>}
          {filtered.length > visibleRegular.length && (
            <p className="border-t border-gray-100 px-3 py-2 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Mostrando {visibleRegular.length} de {filtered.length}. Escribí para acotar la búsqueda.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
