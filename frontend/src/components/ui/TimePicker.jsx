import React, { useCallback, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import Popover from "./Popover";

const pad = (n) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

// value: "HH:mm" (24h). Shown in 12h. onChange receives { target: { name, value } }.
export default function TimePicker({ value, onChange, name, required = false, size = "md", variant = "field", className = "", align = "left" }) {
  const [h24, min] = (value || "09:00").split(":").map(Number);
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const popRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  // bring the selected hour/minute into view when opening
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      document.querySelectorAll(".tp-col .selected").forEach((el) => el.scrollIntoView({ block: "center" }));
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  const emit = (h12v, minv, per) => {
    const h = (h12v % 12) + (per === "PM" ? 12 : 0);
    onChange({ target: { name, value: `${pad(h)}:${pad(minv)}` } });
  };

  const label = `${h12}:${pad(min)} ${period}`;

  return (
    <div ref={wrapRef} className={`ui-select ${size} ${variant} ${className}`}>
      <button
        type="button"
        className={`ui-trigger ${open ? "open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Clock size={16} className="ui-lead" />
        <span className="ui-value">{label}</span>
      </button>
      {required && <input className="ui-required" tabIndex={-1} required value={value ?? ""} onChange={() => {}} aria-hidden="true" />}

      <Popover anchorRef={wrapRef} open={open} onClose={close} align={align} className="ui-pop-time">
        <div className="tp" ref={popRef}>
          <div className="tp-cols">
            <div className="tp-col" role="listbox" aria-label="Hour">
              {HOURS.map((h) => (
                <button type="button" key={h} className={`tp-cell ${h === h12 ? "selected" : ""}`} onClick={() => emit(h, min, period)}>
                  {pad(h)}
                </button>
              ))}
            </div>
            <div className="tp-col" role="listbox" aria-label="Minute">
              {MINUTES.map((m) => (
                <button type="button" key={m} className={`tp-cell ${m === min ? "selected" : ""}`} onClick={() => emit(h12, m, period)}>
                  {pad(m)}
                </button>
              ))}
            </div>
            <div className="tp-col tp-period" role="listbox" aria-label="AM or PM">
              {["AM", "PM"].map((p) => (
                <button type="button" key={p} className={`tp-cell ${p === period ? "selected" : ""}`} onClick={() => emit(h12, min, p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="cal-foot">
            <button type="button" className="link-btn" onClick={() => { const n = new Date(); onChange({ target: { name, value: `${pad(n.getHours())}:${pad(n.getMinutes())}` } }); }}>
              Now
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={close}>Done</button>
          </div>
        </div>
      </Popover>
    </div>
  );
}
