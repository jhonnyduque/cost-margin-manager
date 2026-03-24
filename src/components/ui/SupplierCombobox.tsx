import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Building2, Check } from 'lucide-react';
import { useStore } from '../../store';

interface SupplierComboboxProps {
  value: string;
  onChange: (name: string) => void;
  label?: string;
  placeholder?: string;
}

/**
 * SupplierCombobox — Combobox input that autocompletes against existing suppliers
 * and offers inline creation of new ones. Follows the Notion/Linear pattern.
 */
const SupplierCombobox: React.FC<SupplierComboboxProps> = ({
  value,
  onChange,
  label = 'Proveedor',
  placeholder = 'Buscar o crear proveedor...',
}) => {
  const { suppliers, addSupplier } = useStore();
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes (e.g. form reset)
  useEffect(() => { setInputValue(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const trimmed = inputValue.trim();
  const term = trimmed.toLowerCase();

  // Filter suppliers by name or tax_id
  const filtered = trimmed.length > 0
    ? suppliers
        .filter(s => s.status === 'activo')
        .filter(s =>
          s.name.toLowerCase().includes(term) ||
          (s.tax_id && s.tax_id.toLowerCase().includes(term))
        )
        .slice(0, 6)
    : [];

  const exactMatch = suppliers.some(
    s => s.name.toLowerCase() === term && s.status === 'activo'
  );

  const showCreate = trimmed.length > 0 && !exactMatch;
  const totalOptions = filtered.length + (showCreate ? 1 : 0);

  const handleSelect = useCallback((name: string) => {
    setInputValue(name);
    onChange(name);
    setIsOpen(false);
    setHighlightIndex(-1);
  }, [onChange]);

  const handleCreate = useCallback(async () => {
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    try {
      const created = await addSupplier({
        name: trimmed,
        status: 'activo',
        company_id: '',   // store overrides
        notes: null,
        tax_id: null,
        email: null,
        phone: null,
        address: null,
        payment_terms_days: null,
      } as any);
      handleSelect(created?.name || trimmed);
    } catch {
      // Silently fail — field still has the typed text
      handleSelect(trimmed);
    } finally {
      setIsCreating(false);
    }
  }, [trimmed, isCreating, addSupplier, handleSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && totalOptions > 0) { setIsOpen(true); e.preventDefault(); }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(prev => (prev + 1) % totalOptions);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(prev => (prev - 1 + totalOptions) % totalOptions);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          handleSelect(filtered[highlightIndex].name);
        } else if (highlightIndex === filtered.length && showCreate) {
          handleCreate();
        } else if (filtered.length === 1 && !showCreate) {
          handleSelect(filtered[0].name);
        } else if (showCreate && totalOptions === 1) {
          handleCreate();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightIndex(-1);
        break;
    }
  };

  const handleBlur = () => {
    // Commit the current value when losing focus (delayed to allow click on dropdown)
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        onChange(inputValue.trim());
        setIsOpen(false);
      }
    }, 150);
  };

  // ── Styles ──
  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 50,
    marginTop: 'var(--space-4)',
    background: 'var(--surface-card)',
    border: 'var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    maxHeight: '15rem',
    overflowY: 'auto',
  };

  const optionBase: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-8)',
    padding: 'var(--space-10) var(--space-12)',
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 'var(--text-body-size)',
    color: 'var(--text-primary)',
    transition: 'background var(--transition-fast)',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <label className="field-label">{label}</label>
      )}
      <div style={{ position: 'relative' }}>
        <Building2
          size={14}
          style={{
            position: 'absolute',
            left: 'var(--space-10)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          className="input"
          value={inputValue}
          placeholder={placeholder}
          style={{ paddingLeft: 'var(--space-32)' }}
          onChange={e => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => { if (trimmed.length > 0) setIsOpen(true); }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </div>

      {isOpen && totalOptions > 0 && (
        <div style={dropdownStyle}>
          {filtered.map((s, i) => (
            <button
              key={s.id}
              type="button"
              style={{
                ...optionBase,
                background: highlightIndex === i ? 'var(--surface-muted)' : 'transparent',
                fontWeight: s.name.toLowerCase() === term ? 700 : 500,
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={e => { e.preventDefault(); handleSelect(s.name); }}
            >
              {s.name.toLowerCase() === term ? (
                <Check size={14} style={{ color: 'var(--state-success)', flexShrink: 0 }} />
              ) : (
                <Building2 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              )}
              <span style={{ flex: 1 }}>{s.name}</span>
              {s.tax_id && (
                <span className="text-small text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {s.tax_id}
                </span>
              )}
            </button>
          ))}

          {showCreate && (
            <button
              type="button"
              style={{
                ...optionBase,
                background: highlightIndex === filtered.length ? 'var(--surface-primary-soft)' : 'transparent',
                color: 'var(--state-primary)',
                fontWeight: 600,
                borderTop: filtered.length > 0 ? 'var(--border-default)' : 'none',
              }}
              onMouseEnter={() => setHighlightIndex(filtered.length)}
              onMouseDown={e => { e.preventDefault(); handleCreate(); }}
            >
              <Plus size={14} style={{ flexShrink: 0 }} />
              <span>
                {isCreating ? 'Creando...' : <>Crear <strong>"{trimmed}"</strong> como proveedor</>}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SupplierCombobox;
