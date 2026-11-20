import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import Popover from "./Popover";

// Themed replacement for <select>. onChange receives { target: { name, value } } so existing form handlers keep working.
export default function Select({
  value,
  onChange,
  options,
  name,
  placeholder = "Select",
  required = false,
  disabled = false,
  size = "md", // md | sm
  variant = "field", // field | on-dark (dark sidebar)
  ariaLabel,
  className = "",
  title,
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const typed = useRef({ text: "", t: 0 });

  const selected = options.find((o) => String(o.value) === String(value));
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const close = useCallback(() => setOpen(false), []);
  const commit = (opt) => {
    if (!opt || opt.disabled) return;
    onChange({ target: { name, value: opt.value } });
    setOpen(false);
  };

  const openMenu = () => {
    if (disabled) return;
    const idx = options.findIndex((o) => String(o.value) === String(value));
    setHi(idx >= 0 ? idx : enabled[0] ?? -1);
    setOpen(true);
  };

  const move = (dir) => {
    if (!enabled.length) return;
    const cur = enabled.indexOf(hi);
    const next = cur === -1 ? (dir > 0 ? 0 : enabled.length - 1) : (cur + dir + enabled.length) % enabled.length;
    setHi(enabled[next]);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); setHi(enabled[0]); }
    else if (e.key === "End") { e.preventDefault(); setHi(enabled[enabled.length - 1]); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); commit(options[hi]); }
    else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      // type-ahead
      const now = Date.now();
      typed.current.text = now - typed.current.t > 700 ? e.key.toLowerCase() : typed.current.text + e.key.toLowerCase();
      typed.current.t = now;
      const idx = options.findIndex((o) => !o.disabled && String(o.label).toLowerCase().startsWith(typed.current.text));
      if (idx >= 0) setHi(idx);
    }
  };

  // keep the highlighted option visible
  useEffect(() => {
    if (open && hi >= 0) listRef.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, hi]);

  return (
    <div ref={wrapRef} className={`ui-select ${size} ${variant} ${className}`}>
      <button
        type="button"
        className={`ui-trigger ${open ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={`ui-value ${selected ? "" : "placeholder"}`}>{selected ? selected.short ?? selected.label : placeholder}</span>
        <ChevronDown size={16} className="ui-chevron" />
      </button>

      {/* lets the browser's native "required" validation work with this custom control */}
      {required && (
        <input className="ui-required" tabIndex={-1} required value={value ?? ""} onChange={() => {}} aria-hidden="true" />
      )}

      <Popover anchorRef={wrapRef} open={open} onClose={close} role="listbox" className="ui-menu">
        <ul ref={listRef} className="ui-list">
          {options.map((o, i) => {
            const isSel = String(o.value) === String(value);
            return (
              <li
                key={String(o.value)}
                data-i={i}
                role="option"
                aria-selected={isSel}
                aria-disabled={o.disabled || undefined}
                className={`ui-option ${isSel ? "selected" : ""} ${i === hi ? "hi" : ""} ${o.disabled ? "disabled" : ""}`}
                onMouseEnter={() => !o.disabled && setHi(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(o)}
              >
                <span>{o.label}</span>
                {isSel && <Check size={15} />}
              </li>
            );
          })}
          {options.length === 0 && <li className="ui-option disabled">No options</li>}
        </ul>
      </Popover>
    </div>
  );
}
