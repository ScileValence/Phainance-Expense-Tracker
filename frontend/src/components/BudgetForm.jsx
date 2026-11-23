import MonthPicker from "./ui/MonthPicker";
import React, { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import Sidebar from "./Sidebar";
import StatusBanner from "./StatusBanner";
import CountUp from "./CountUp";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, Check, CalendarClock, TrendingUp, Wallet, Target } from "lucide-react";
import { burstFrom } from "../utils/motion";
import { useCategories } from "../utils/categories";
import { colorFor } from "../utils/palette";
import { money, toBase, toInput, currencySymbol } from "../utils/currency";
import "../styles/dashboard.css";
import "../styles/entry.css";

const R = 74; // gauge radius

// one category: spent so far, an optional monthly limit, saved when you leave the field or press Enter
function LimitRow({ cat, spent, limit, onSave }) {
  const [val, setVal] = useState(limit ? toInput(limit) : "");
  const [saved, setSaved] = useState(false);
  useEffect(() => setVal(limit ? toInput(limit) : ""), [limit]);

  const commit = async () => {
    const base = val === "" ? 0 : toBase(val);
    if (base === (limit || 0)) return;
    if (await onSave(cat.id, base)) {
      setSaved(true);
      setTimeout(() => setSaved(false), 900);
    }
  };

  const ratio = limit > 0 ? spent / limit : 0;
  const tone = ratio > 1 ? "var(--coral)" : ratio >= 0.8 ? "var(--amber)" : "var(--ok)";

  return (
    <div className="limit-row">
      <div className="limit-top">
        <span className="dot" style={{ background: colorFor(cat.name) }} />
        <span className="name">{cat.name}</span>
        {limit > 0 && (
          <span className="limit-state" style={{ color: tone }}>
            {ratio > 1 ? `Over by ${money(spent - limit)}` : `${Math.round(ratio * 100)}% used`}
          </span>
        )}
        <span className="limit-field">
          <input
            className="input input-sm limit-input"
            type="number"
            min="0"
            value={val}
            placeholder="No limit"
            aria-label={`Monthly limit for ${cat.name}`}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
          {saved && <Check size={15} className="draw-check limit-ok" strokeWidth={3} />}
        </span>
      </div>
      {limit > 0 && (
        <div className="limit-bottom">
          <div className="progress"><span style={{ width: `${Math.min(ratio * 100, 100)}%`, background: tone }} /></div>
          <span>{money(spent)} of {money(limit)}</span>
        </div>
      )}
    </div>
  );
}
const C = 2 * Math.PI * R;

export default function BudgetForm() {
  const [limit, setLimit] = useState("");
  const [info, setInfo] = useState({ month: "", limit: 0, spent: 0 });
  const [cats, setCats] = useState([]);
  const [past, setPast] = useState([]); // spending in the months before the selected one
  const [limits, setLimits] = useState([]); // monthly limit per category
  const { categories } = useCategories();
  const [month, setMonth] = useState(
    localStorage.getItem("selectedMonth") || new Date().toISOString().slice(0, 7)
  );
  const navigate = useNavigate();

  const fetchBudget = () =>
    api
      .get(`/budget?month=${month}`)
      .then((res) => {
        setInfo(res.data || { month, limit: 0, spent: 0 });
        setLimit(res.data?.limit ? toInput(res.data.limit) : "");
      })
      .catch(() => toast.error("Failed to fetch budget data"));

  useEffect(() => {
    fetchBudget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, navigate]);

  // where the money went this month, and what the last few months looked like
  useEffect(() => {
    let live = true;
    api
      .get(`/analytics/category?month=${month}`)
      .then((r) => live && setCats((r.data || []).filter((c) => c.value > 0).sort((a, b) => b.value - a.value)))
      .catch(() => live && setCats([]));
    api
      .get(`/analytics/trend?month=${month}&months=4`)
      .then((r) => live && setPast((r.data || []).slice(0, -1).filter((m) => m.amount > 0)))
      .catch(() => live && setPast([]));
    api
      .get(`/budget/categories?month=${month}`)
      .then((r) => live && setLimits(r.data || []))
      .catch(() => live && setLimits([]));
    return () => {
      live = false;
    };
  }, [month, info.spent]);

  const saveLimit = async (categoryId, base) => {
    try {
      await api.put(`/budget/categories/${categoryId}`, { limitAmount: base });
      const r = await api.get(`/budget/categories?month=${month}`);
      setLimits(r.data || []);
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save the limit");
      return false;
    }
  };

  const [done, setDone] = useState(false);
  const saveBtn = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    api
      .post("/budget", { limitAmount: toBase(limit), month })
      .then(() => {
        toast.success("Budget saved");
        setDone(true);
        burstFrom(saveBtn.current, { count: 8, spread: 0.9 });
        setTimeout(() => setDone(false), 900);
        fetchBudget();
      })
      .catch(() => toast.error("Error saving budget"));
  };

  const monthLabel = new Date(`${month}-01`).toLocaleString("default", { month: "long", year: "numeric" });
  const ratio = info.limit > 0 ? info.spent / info.limit : 0;
  const left = info.limit - info.spent;
  const ringColor = ratio > 0.9 ? "var(--coral)" : ratio > 0.7 ? "var(--amber)" : "var(--ok)";

  // ---- suggestion: based on the previous months ----
  const avg = past.length ? past.reduce((s, m) => s + m.amount, 0) / past.length : 0;
  const buffered = Math.ceil((avg * 1.1) / 100) * 100;

  // ---- pace (only for the current month) ----
  const now = new Date();
  const [y, m] = month.split("-").map(Number);
  const isCurrent = y === now.getFullYear() && m === now.getMonth() + 1;
  const daysInMonth = new Date(y, m, 0).getDate();
  const day = now.getDate();
  const daysLeft = daysInMonth - day + 1;
  const perDay = left > 0 ? left / daysLeft : 0;
  const projected = day > 0 ? (info.spent / day) * daysInMonth : 0;
  const projectedGap = info.limit - projected;

  const catTotal = cats.reduce((s, c) => s + c.value, 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page">
        <StatusBanner />
        <header className="page-head fade-in">
          <div>
            <div className="eyebrow">{monthLabel}</div>
            <h2>Monthly budget</h2>
          </div>
          <button className="btn btn-ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={16} /> Back
          </button>
        </header>

        <div className="entry-layout">
          <div className="entry-main">
            <form className="card fade-in" onSubmit={submit}>
              <div className="form-grid">
                <div className="field">
                  <label>Month</label>
                  <MonthPicker
                    value={month}
                    onChange={(e) => {
                      setMonth(e.target.value);
                      localStorage.setItem("selectedMonth", e.target.value);
                    }}
                    required
                  />
                </div>
                <div className="field">
                  <label>Budget limit ({currencySymbol()})</label>
                  <input
                    className="input"
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder={info.limit ? `Current: ${money(info.limit)}` : "Enter budget limit"}
                    required
                  />
                </div>
              </div>
              <div className="form-actions">
                <button ref={saveBtn} type="submit" className={`btn btn-primary btn-save ${done ? "is-done" : ""}`} disabled={done}>
                  {done && <Check size={17} className="draw-check" strokeWidth={3} />}
                  {done ? "Saved" : "Save budget"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => navigate("/dashboard")}>Cancel</button>
              </div>
            </form>

            <section className="card fade-in">
              <div className="card-head" style={{ marginBottom: 6 }}>
                <div>
                  <h3 className="card-title">Suggested limit</h3>
                  <div className="card-sub">From your recent spending</div>
                </div>
                <div className="insight-icon"><TrendingUp size={18} /></div>
              </div>
              {past.length === 0 ? (
                <p className="card-lead">Once you have a full month of expenses, a suggested limit will show up here.</p>
              ) : (
                <>
                  <p className="card-lead">
                    You spent about <strong>{money(avg)}</strong> a month over the last {past.length} month{past.length > 1 ? "s" : ""}.
                    Tap a suggestion to fill in the limit.
                  </p>
                  <div className="suggest">
                    <button type="button" className="chip" onClick={() => setLimit(toInput(Math.round(avg)))}>
                      <small>Match your average</small>
                      <strong>{money(Math.round(avg))}</strong>
                    </button>
                    <button type="button" className="chip" onClick={() => setLimit(toInput(buffered))}>
                      <small>Average + 10% room</small>
                      <strong>{money(buffered)}</strong>
                    </button>
                  </div>
                </>
              )}
            </section>

            <section className="card fade-in">
              <div className="card-head" style={{ marginBottom: 6 }}>
                <div>
                  <h3 className="card-title">Category limits</h3>
                  <div className="card-sub">A monthly cap per category</div>
                </div>
                <div className="insight-icon"><Target size={18} /></div>
              </div>
              <p className="card-lead">Limits apply every month. You get an alert at 80% and again when you go over.</p>
              <div className="limit-list">
                {categories.map((c) => (
                  <LimitRow
                    key={c.id}
                    cat={c}
                    spent={cats.find((x) => x.name === c.name)?.value || 0}
                    limit={limits.find((l) => l.categoryId === c.id)?.limit || 0}
                    onSave={saveLimit}
                  />
                ))}
              </div>
            </section>

            <section className="card fade-in">
              <div className="card-head" style={{ marginBottom: 14 }}>
                <div>
                  <h3 className="card-title">Where it goes</h3>
                  <div className="card-sub">Top categories in {monthLabel}</div>
                </div>
              </div>
              {cats.length === 0 ? (
                <div className="empty" style={{ padding: "18px 8px" }}>
                  <p>No expenses this month yet.</p>
                </div>
              ) : (
                <div className="cat-bars">
                  {cats.slice(0, 5).map((c) => {
                    const share = catTotal > 0 ? Math.round((c.value / catTotal) * 100) : 0;
                    return (
                      <div key={c.name}>
                        <div className="cat-bar-top">
                          <span className="dot" style={{ background: colorFor(c.name) }} />
                          <span className="name">{c.name}</span>
                          <span className="val">{money(c.value)}</span>
                          <span className="pct">{share}%</span>
                        </div>
                        <div className="progress"><span style={{ width: `${share}%`, background: colorFor(c.name) }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="entry-side">
            <section className="card fade-in">
              <div className="card-head" style={{ marginBottom: 8 }}>
                <div>
                  <h3 className="card-title">Budget used</h3>
                  <div className="card-sub">{monthLabel}</div>
                </div>
              </div>
              <div className="gauge-wrap">
                {info.limit > 0 ? (
                  <div className="gauge">
                    <svg viewBox="0 0 176 176" aria-hidden="true">
                      <circle className="track" cx="88" cy="88" r={R} />
                      <circle
                        className="fill"
                        cx="88"
                        cy="88"
                        r={R}
                        stroke={ringColor}
                        strokeDasharray={C}
                        strokeDashoffset={C * (1 - Math.min(ratio, 1))}
                      />
                    </svg>
                    <div className="gauge-center">
                      <strong><CountUp value={Math.round(ratio * 100)} format={(v) => `${Math.round(v)}%`} /></strong>
                      <span>used</span>
                    </div>
                  </div>
                ) : (
                  <p className="gauge-empty">Set a limit for {monthLabel} to see how much of it you have used.</p>
                )}
              </div>
              {info.limit > 0 && (
                <div className="tile-row">
                  <div className="tile"><span>Limit</span><strong>{money(info.limit)}</strong></div>
                  <div className="tile"><span>Spent</span><strong>{money(info.spent)}</strong></div>
                  <div className="tile"><span>{left < 0 ? "Over by" : "Left"}</span><strong className={left < 0 ? "bad" : "good"}>{money(Math.abs(left))}</strong></div>
                </div>
              )}
            </section>

            {isCurrent && info.limit > 0 && (
              <section className="card fade-in">
                <div className="pace-line">
                  <span className="pace-icon"><CalendarClock size={18} /></span>
                  <span>
                    {left > 0 ? (
                      <>You can spend about <strong>{money(Math.round(perDay))}</strong> a day for the next {daysLeft} day{daysLeft > 1 ? "s" : ""}.</>
                    ) : (
                      <>You have already used the whole budget with {daysLeft} day{daysLeft > 1 ? "s" : ""} to go.</>
                    )}
                  </span>
                </div>
                <div className="pace-line">
                  <span className="pace-icon"><Wallet size={18} /></span>
                  <span>
                    At this pace you will spend <strong>{money(Math.round(projected))}</strong> this month,{" "}
                    {projectedGap >= 0 ? (
                      <span className="good">{money(Math.round(projectedGap))} under budget</span>
                    ) : (
                      <span className="bad">{money(Math.round(-projectedGap))} over budget</span>
                    )}.
                  </span>
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
