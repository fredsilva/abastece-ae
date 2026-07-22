import { useEffect, useRef, useState } from "react";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function Combobox({ value, onChange, options, placeholder, disabled, loading, emptyMessage = "Nenhum resultado" }: Props) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(selectedLabel);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedLabel]);

  const filtered =
    query.trim() === "" || query === selectedLabel
      ? options
      : options.filter((o) => normalize(o.label).includes(normalize(query)));

  useEffect(() => {
    setHighlighted(0);
  }, [query, open]);

  function selectOption(option: ComboboxOption) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <div className="combobox" ref={containerRef}>
      <div className="combobox-input-wrap">
        <svg className="combobox-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          className="text-input combobox-input"
          value={query}
          disabled={disabled}
          placeholder={loading ? "Carregando..." : (placeholder ?? "Buscar...")}
          onFocus={(e) => {
            setOpen(true);
            e.target.select();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery(selectedLabel);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const option = filtered[highlighted];
              if (option) selectOption(option);
            }
          }}
        />
      </div>

      {open && !disabled && (
        <ul className="combobox-list">
          {loading ? (
            <li className="combobox-empty">Carregando...</li>
          ) : filtered.length === 0 ? (
            <li className="combobox-empty">{emptyMessage}</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value}
                className={`combobox-option${o.value === value ? " combobox-option--selected" : ""}${i === highlighted ? " combobox-option--highlighted" : ""}`}
                onMouseEnter={() => setHighlighted(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(o);
                }}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
