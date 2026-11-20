import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 12-month grid with year navigation. Shared by MonthPicker and the DatePicker title view.
export default function MonthGrid({ year, month, selectedYear, selectedMonth, onYear, onPick }) {
  const now = new Date();
  return (
    <div className="mg">
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => onYear(-1)} aria-label="Previous year"><ChevronLeft size={16} /></button>
        <span className="cal-title static">{year}</span>
        <button type="button" className="cal-nav" onClick={() => onYear(1)} aria-label="Next year"><ChevronRight size={16} /></button>
      </div>
      <div className="mg-grid">
        {MONTHS.map((m, i) => {
          const sel = year === selectedYear && i === selectedMonth;
          const cur = year === now.getFullYear() && i === now.getMonth();
          return (
            <button
              type="button"
              key={m}
              className={`mg-cell ${sel ? "selected" : ""} ${cur ? "today" : ""}`}
              onClick={() => onPick(year, i)}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
