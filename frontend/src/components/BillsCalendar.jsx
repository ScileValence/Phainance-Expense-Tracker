import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { occurrencesBetween } from "../utils/recurringSchedule";
import { colorFor } from "../utils/palette";
import { money, hhmm } from "../utils/recurring";

const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Upcoming bills on a month grid (Monday first). Paused payments are left out.
export default function BillsCalendar({ payments }) {
  const now = new Date();
  const todayIso = iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [selected, setSelected] = useState(todayIso);

  const { rows, byDay, count, total } = useMemo(() => {
    const { y, m } = cursor;
    const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday = 0
    const days = new Date(y, m, 0).getDate();
    const cells = Array(offset).fill(null);
    for (let d = 1; d <= days; d++) cells.push(iso(y, m, d));
    while (cells.length % 7) cells.push(null);

    const byDay = {};
    let count = 0;
    let total = 0;
    payments.forEach((p) =>
      occurrencesBetween(p, iso(y, m, 1), iso(y, m, days)).forEach((date) => {
        (byDay[date] = byDay[date] || []).push(p);
        count += 1;
        total += p.amount || 0;
      })
    );

    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return { rows, byDay, count, total };
  }, [cursor, payments]);

  const go = (delta) => {
    const index = cursor.y * 12 + (cursor.m - 1) + delta;
    setCursor({ y: Math.floor(index / 12), m: (index % 12) + 1 });
    setSelected(null);
  };
  const goToday = () => {
    setCursor({ y: now.getFullYear(), m: now.getMonth() + 1 });
    setSelected(todayIso);
  };

  const label = new Date(cursor.y, cursor.m - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
  const picked = selected && selected.startsWith(`${cursor.y}-${pad(cursor.m)}`) ? byDay[selected] || [] : null;
  const pickedLabel = selected ? new Date(`${selected}T00:00:00`).toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" }) : "";

  return (
    <section className="card bills-cal fade-in">
      <div className="bills-head">
        <div className="bills-title">
          <h3 className="card-title">{label}</h3>
          <div className="card-sub" data-testid="bills-summary">
            {count === 0 ? "No bills due" : `${count} bill${count === 1 ? "" : "s"} · ${money(total)} due`}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={goToday}>Today</button>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => go(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => go(1)} aria-label="Next month"><ChevronRight size={16} /></button>
      </div>

      <div className="bills-grid" role="grid" aria-label={label}>
        {WEEKDAYS.map((w) => <div className="bills-wd" key={w}>{w}</div>)}
        {rows.flat().map((date, i) => {
          if (!date) return <div className="bills-cell blank" key={`b${i}`} />;
          const list = byDay[date] || [];
          const day = Number(date.slice(8));
          return (
            <button
              type="button"
              key={date}
              data-date={date}
              className={`bills-cell ${date === todayIso ? "is-today" : ""} ${date === selected ? "is-selected" : ""} ${list.length ? "has-bills" : ""}`}
              aria-label={`${date}, ${list.length} bill${list.length === 1 ? "" : "s"}`}
              onClick={() => setSelected(date)}
            >
              <span className="bills-day">{day}</span>
              {list.slice(0, 2).map((p) => (
                <span className="bills-chip" key={p.id} style={{ "--c": colorFor(p.category?.name || p.title) }}>{p.title}</span>
              ))}
              {list.length > 2 && <span className="bills-more">+{list.length - 2} more</span>}
              {list.length > 0 && (
                <span className="bills-dots" aria-hidden="true">
                  {list.slice(0, 3).map((p) => <i key={p.id} style={{ background: colorFor(p.category?.name || p.title) }} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bills-day-list">
        {picked === null ? (
          <p className="hint">Choose a day to see its bills. Paused payments are not shown, and neither are bills already paid.</p>
        ) : (
          <>
            <h4>{pickedLabel}</h4>
            {picked.length === 0 ? (
              <p className="hint">Nothing due.</p>
            ) : (
              picked.map((p) => (
                <div className="bills-row" key={p.id}>
                  <span className="dot" style={{ background: colorFor(p.category?.name || p.title) }} />
                  <span className="name">{p.title}</span>
                  <span className="when">{hhmm(p.dueTime)}</span>
                  <span className="amt">{money(p.amount)}</span>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </section>
  );
}
