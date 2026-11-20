import React, { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import Popover from "./Popover";
import MonthGrid from "./MonthGrid";

const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// value: "YYYY-MM-DD". onChange receives { target: { name, value } }.
export default function DatePicker({
  value, onChange, name, required = false, placeholder = "Select date",
  size = "md", variant = "field", className = "", align = "left",
}) {
  const selected = parse(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => selected || new Date());
  const [focus, setFocus] = useState(() => selected || new Date());
  const [mode, setMode] = useState("days"); // days | months
  const wrapRef = useRef(null);
  const gridRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  const openPicker = () => {
    const base = selected || new Date();
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
    setFocus(base);
    setMode("days");
    setOpen(true);
  };

  useEffect(() => {
    if (open && mode === "days") gridRef.current?.focus({ preventScroll: true });
  }, [open, mode]);

  const pick = (d) => {
    onChange({ target: { name, value: fmt(d) } });
    setOpen(false);
  };

  const goto = (d) => {
    setFocus(d);
    setView(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const onGridKey = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) {
      e.preventDefault();
      goto(new Date(focus.getFullYear(), focus.getMonth(), focus.getDate() + step));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const delta = e.key === "PageUp" ? -1 : 1;
      goto(new Date(focus.getFullYear(), focus.getMonth() + delta, Math.min(focus.getDate(), 28)));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(focus);
    }
  };

  // 6-week grid starting on Sunday
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const today = new Date();

  const label = selected
    ? selected.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : placeholder;

  return (
    <div ref={wrapRef} className={`ui-select ${size} ${variant} ${className}`}>
      <button
        type="button"
        className={`ui-trigger ${open ? "open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : openPicker())}
      >
        <Calendar size={16} className="ui-lead" />
        <span className={`ui-value ${selected ? "" : "placeholder"}`}>{label}</span>
      </button>
      {required && <input className="ui-required" tabIndex={-1} required value={value ?? ""} onChange={() => {}} aria-hidden="true" />}

      <Popover anchorRef={wrapRef} open={open} onClose={close} align={align} className="ui-pop-date">
        {mode === "months" ? (
          <MonthGrid
            year={view.getFullYear()}
            month={view.getMonth()}
            selectedYear={view.getFullYear()}
            selectedMonth={view.getMonth()}
            onYear={(d) => setView(new Date(view.getFullYear() + d, view.getMonth(), 1))}
            onPick={(y, m) => {
              setView(new Date(y, m, 1));
              setFocus(new Date(y, m, 1));
              setMode("days");
            }}
          />
        ) : (
          <div className="cal">
            <div className="cal-head">
              <button type="button" className="cal-nav" onClick={() => goto(new Date(view.getFullYear(), view.getMonth() - 1, 1))} aria-label="Previous month">
                <ChevronLeft size={16} />
              </button>
              <button type="button" className="cal-title" onClick={() => setMode("months")} title="Choose month and year">
                {view.toLocaleString("default", { month: "long", year: "numeric" })}
              </button>
              <button type="button" className="cal-nav" onClick={() => goto(new Date(view.getFullYear(), view.getMonth() + 1, 1))} aria-label="Next month">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="cal-week">{WEEK.map((w) => <span key={w}>{w}</span>)}</div>

            <div className="cal-grid" ref={gridRef} tabIndex={0} role="grid" onKeyDown={onGridKey}>
              {days.map((d) => {
                const other = d.getMonth() !== view.getMonth();
                return (
                  <button
                    type="button"
                    tabIndex={-1}
                    key={fmt(d)}
                    className={[
                      "cal-day",
                      other ? "other" : "",
                      sameDay(d, selected) ? "selected" : "",
                      sameDay(d, today) ? "today" : "",
                      sameDay(d, focus) ? "focus" : "",
                    ].join(" ")}
                    onClick={() => pick(d)}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="cal-foot">
              <button type="button" className="link-btn" onClick={() => pick(new Date())}>Today</button>
              {!required && value && (
                <button type="button" className="link-btn" onClick={() => { onChange({ target: { name, value: "" } }); setOpen(false); }}>Clear</button>
              )}
            </div>
          </div>
        )}
      </Popover>
    </div>
  );
}
