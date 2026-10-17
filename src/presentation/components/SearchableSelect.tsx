import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  children: React.ReactNode;
  placeholder?: string;
};

type Item = { value: string; label: string; group?: string; disabled: boolean };

const textOf = (node: React.ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return '';
};

const collectOptions = (children: React.ReactNode, group?: string): Item[] => {
  const items: Item[] = [];
  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) return;
    if (child.type === 'optgroup') {
      const props = child.props as { label?: string; children?: React.ReactNode };
      items.push(...collectOptions(props.children, props.label));
    } else if (child.type === 'option') {
      const props = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
      const label = textOf(props.children).trim();
      items.push({ value: String(props.value ?? label), label, group, disabled: !!props.disabled });
    }
  });
  return items;
};

const normalize = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

export function SearchableSelect({
  children, value, defaultValue, onChange, className = '', disabled, required,
  id, name, placeholder, 'aria-label': ariaLabel
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const generatedId = useId().replaceAll(':', '');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const options = useMemo(() => collectOptions(children), [children]);
  const currentValue = String(value ?? defaultValue ?? '');
  const selected = options.find(option => option.value === currentValue);
  const emptyLabel = options.find(option => option.value === '')?.label;
  const listId = `${id || name || generatedId}-options`;
  const matches = useMemo(() => {
    const term = normalize(query.trim());
    return options.filter(option => !option.disabled &&
      (!term || normalize(`${option.label} ${option.group || ''}`).includes(term)));
  }, [options, query]);
  const visible = matches.slice(0, 50);
  const activeIndex = Math.min(active, Math.max(visible.length - 1, 0));

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('focusin', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('focusin', close);
    };
  }, [open]);

  const choose = (option: Item) => {
    onChange?.({
      target: { value: option.value, name },
      currentTarget: { value: option.value, name }
    } as React.ChangeEvent<HTMLSelectElement>);
    setQuery('');
    setActive(0);
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div ref={root} className="relative min-w-0">
      <input
        ref={input}
        id={id || generatedId}
        type="search"
        role="combobox"
        aria-label={ariaLabel || placeholder || 'Buscar opción'}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && visible[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        disabled={disabled}
        required={required}
        pattern={required && !currentValue ? '(?!)' : undefined}
        value={open ? query : currentValue ? selected?.label || '' : ''}
        placeholder={placeholder || emptyLabel || 'Buscar una opción'}
        className={`${className} min-w-0`}
        onFocus={() => { setQuery(''); setActive(0); setOpen(true); }}
        onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault(); setOpen(true);
            setActive(index => Math.min(index + 1, Math.max(visible.length - 1, 0)));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault(); setActive(index => Math.max(index - 1, 0));
          } else if (event.key === 'Enter' && open) {
            event.preventDefault();
            if (visible[activeIndex]) choose(visible[activeIndex]);
          } else if (event.key === 'Escape' || event.key === 'Tab') {
            setOpen(false);
          }
        }}
      />
      {name && <input type="hidden" name={name} value={currentValue} />}
      {open && (
        <div id={listId} role="listbox" className="relative z-[100] mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-gray-300 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-[#1E293B]">
          {visible.map((option, index) => (
            <button
              key={`${option.value}-${index}`}
              id={`${listId}-${index}`}
              type="button"
              role="option"
              aria-selected={option.value === currentValue}
              onClick={() => choose(option)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700 ${index === activeIndex ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
            >
              {option.group && <span className="block text-[10px] font-semibold uppercase text-gray-500">{option.group}</span>}
              <span className="block break-words">{option.label}</span>
            </button>
          ))}
          {matches.length === 0 && <p className="px-3 py-3 text-sm text-gray-500">Sin resultados</p>}
          {matches.length > visible.length && <p className="px-3 py-2 text-xs text-gray-500">Mostrando {visible.length} de {matches.length}. Escribí para acotar.</p>}
        </div>
      )}
    </div>
  );
}
