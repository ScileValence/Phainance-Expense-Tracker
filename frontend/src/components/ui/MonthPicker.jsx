import React, { useCallback, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import Popover from "./Popover";
import MonthGrid from "./MonthGrid";

const pad = (n) => String(n).padStart(2, "0");

// value: "YYYY-MM". onChange receives { target: { name, value } }.
export default function MonthPicker({ value, onChange, name, required, size = "md", variant = "field", className = "", align = "left" }) {
  const now = new Date();
  const [y, m] = (value || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`).split("-").map(Number);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(y);
  const wrapRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  const label = new Date(y, m - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div ref={wrapRef} className={`ui-select ${size} ${variant} ${className}`}>
      <button
        type="button"
        className={`ui-trigger ${open ? "open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setYear(y);
          setOpen((o) => !o);
        }}
      >
        <CalendarDays size={16} className="ui-lead" />
        <span className="ui-value">{label}</span>
      </button>
      {required && <input className="ui-required" tabIndex={-1} required value={value ?? ""} onChange={() => {}} aria-hidden="true" />}

      <Popover anchorRef={wrapRef} open={open} onClose={close} align={align} className="ui-pop-month">
        <MonthGrid
          year={year}
          month={m - 1}
          selectedYear={y}
          selectedMonth={m - 1}
          onYear={(d) => setYear((v) => v + d)}
          onPick={(yy, mm) => {
            onChange({ target: { name, value: `${yy}-${pad(mm + 1)}` } });
            setOpen(false);
          }}
        />
      </Popover>
    </div>
  );
}
