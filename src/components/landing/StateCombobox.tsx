import { useEffect, useMemo, useRef, useState } from "react";
import { STATES } from "@/lib/states";

/* ---- searchable state combobox with keyboard nav ---- */

export function StateCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = STATES.find(([c]) => c === value);
  const display = selected ? selected[1] : value;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STATES;
    return STATES.filter(([c, n]) => c.toLowerCase().includes(q) || n.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(code: string) {
    onChange(code);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const choice = filtered[highlight];
      if (choice) pick(choice[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex w-full items-center justify-between border border-border bg-background px-4 py-4 text-left text-base transition-colors hover:border-foreground focus:border-foreground focus:outline-none"
      >
        <span>{display}</span>
        <span className="text-accent">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full border border-foreground bg-background shadow-lg">
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type to filter (e.g. CA, Texas)…"
              className="w-full bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-64 overflow-auto">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-xs text-muted-foreground">No matches.</li>
            )}
            {filtered.map(([code, name], i) => {
              const active = i === highlight;
              const isSelected = code === value;
              return (
                <li key={code}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(code)}
                    className={
                      "flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors " +
                      (active
                        ? "bg-secondary text-foreground"
                        : "text-foreground/90 hover:bg-secondary")
                    }
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-8 text-[10px] uppercase tracking-[0.2em] text-accent">
                        {code}
                      </span>
                      <span>{name}</span>
                    </span>
                    {isSelected && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        selected
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
