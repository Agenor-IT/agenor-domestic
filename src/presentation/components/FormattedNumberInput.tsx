import React, { useState, useEffect } from 'react';

interface FormattedNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (val: number) => void;
  decimals?: number;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  value,
  onChange,
  decimals = 2,
  className = '',
  placeholder = '0,00',
  disabled = false,
  ...rest
}) => {
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Formato número ARS (1.234,56)
  const formatNumber = (num: number): string => {
    if (isNaN(num) || num === 0) return '0,00';
    return num.toLocaleString('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatNumber(value));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    if (value === 0 || displayValue === '0' || displayValue === '0,00') {
      setDisplayValue('');
    } else {
      // Al enfocar, mostrar valor numérico limpio usando coma decimal
      setDisplayValue(value.toString().replace('.', ','));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const trimmed = displayValue.trim();
    if (!trimmed) {
      onChange(0);
      setDisplayValue('0,00');
      return;
    }
    // Parsear valor con coma decimal y puntos de miles
    const normalized = trimmed.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    if (isNaN(parsed)) {
      onChange(0);
      setDisplayValue('0,00');
    } else {
      onChange(parsed);
      setDisplayValue(formatNumber(parsed));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (rest.onKeyDown) {
      rest.onKeyDown(e);
    }
    // Si presiona el punto (.) del teclado físico o teclado numérico (NumpadDecimal / dot), transformarlo en coma decimal (,)
    if (e.key === '.' || e.key === 'Decimal' || e.code === 'NumpadDecimal') {
      e.preventDefault();
      const input = e.currentTarget;
      const start = input.selectionStart ?? displayValue.length;
      const end = input.selectionEnd ?? displayValue.length;

      const before = displayValue.substring(0, start);
      const after = displayValue.substring(end);

      // Si ya hay una coma en la cadena (fuera de la selección actual), ignorar
      if (!before.includes(',') && !after.includes(',')) {
        const newValue = before + ',' + after;
        setDisplayValue(newValue);

        setTimeout(() => {
          input.setSelectionRange(start + 1, start + 1);
        }, 0);

        const normalized = newValue.replace(',', '.');
        const parsed = parseFloat(normalized);
        if (!isNaN(parsed)) {
          onChange(parsed);
        } else {
          onChange(0);
        }
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Convertir automáticamente cualquier punto typed/pasted a coma decimal si no existe coma previa
    if (raw.includes('.')) {
      if (!raw.includes(',')) {
        raw = raw.replace(/\./g, ',');
      } else {
        raw = raw.replace(/\./g, '');
      }
    }

    // Permitir opcionalmente signo menos al inicio, dígitos y máximo una coma decimal
    if (/^[-]?\d*(?:,\d*)?$/.test(raw)) {
      setDisplayValue(raw);
      const normalized = raw.replace(',', '.');
      const parsed = parseFloat(normalized);
      if (!isNaN(parsed)) {
        onChange(parsed);
      } else if (raw === '' || raw === '-') {
        onChange(0);
      }
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={displayValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      placeholder={placeholder}
      className={`text-right font-mono font-bold ${className}`}
      {...rest}
    />
  );
};
