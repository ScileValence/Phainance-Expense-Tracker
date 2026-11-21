import Select from "./ui/Select";
import DatePicker from "./ui/DatePicker";
import React, { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useCategories } from "../utils/categories";
import { burstFrom } from "../utils/motion";
import StatusBanner from "./StatusBanner";
import { toBase, toInput, money, currencySymbol } from "../utils/currency";
import { colorFor } from "../utils/palette";
import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, Check, Loader2, Receipt } from "lucide-react";
import "../styles/dashboard.css";
import "../styles/entry.css";

export default function AddExpense() {
  const navigate = useNavigate();
  const { categories } = useCategories();
  const [form, setForm] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    categoryId: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ---- live preview, budget impact and recent entries (fills the right-hand side) ----
  const amountRef = useRef(null);
  const [budget, setBudget] = useState(null); // { limit, spent } for the month of the chosen date
  const [recent, setRecent] = useState([]);
  const entryMonth = (form.date || "").slice(0, 7);

  useEffect(() => {
    if (!entryMonth) return;
    let live = true;
    api
      .get(`/budget?month=${entryMonth}`)
      .then((res) => live && setBudget(res.data || null))
      .catch(() => live && setBudget(null));
    return () => {
      live = false;
    };
  }, [entryMonth]);

  useEffect(() => {
    const d = new Date();
    const cur = d.toISOString().slice(0, 7);
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 7);
    Promise.all([api.get(`/expenses?month=${cur}`), api.get(`/expenses?month=${prev}`)])
      .then(([a, b]) => {
        const all = [...(a.data || []), ...(b.data || [])].sort((x, y) => (y.date || "").localeCompare(x.date || "") || y.id - x.id);
        const seen = new Set();
        const unique = [];
        for (const e of all) {
          const key = (e.description || "").trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          unique.push(e);
          if (unique.length === 6) break;
        }
        setRecent(unique);
      })
      .catch(() => {});
  }, []);

  const reuse = (e) => {
    setForm((f) => ({ ...f, amount: toInput(e.amount), description: e.description || "", categoryId: e.category?.id || "" }));
    amountRef.current?.focus();
  };

  const picked = categories.find((c) => String(c.id) === String(form.categoryId));
  const amountBase = toBase(form.amount);
  const limit = budget?.limit || 0;
  const spentSoFar = budget?.spent || 0;
  const after = limit - spentSoFar - amountBase;
  const monthName = entryMonth ? new Date(`${entryMonth}-01T00:00:00`).toLocaleString("default", { month: "long" }) : "";
  const dateLabel = form.date ? new Date(`${form.date}T00:00:00`).toLocaleDateString("default", { weekday: "short", day: "numeric", month: "short" }) : "";
  const usedPct = limit > 0 ? Math.min(100, (spentSoFar / limit) * 100) : 0;
  const thisPct = limit > 0 ? Math.min(100 - usedPct, (amountBase / limit) * 100) : 0;
  const accent = picked ? colorFor(picked.name) : undefined;

  // idle -> saving (instant spinner) -> done (check + burst) -> back to the list with the new row highlighted
  const [phase, setPhase] = useState("idle");
  const saveBtn = useRef(null);

  const submitExpense = (e) => {
    e.preventDefault();
    if (phase !== "idle") return;
    setPhase("saving");
    api
      .post("/expenses", {
        amount: toBase(form.amount),
        description: form.description.trim(),
        date: form.date,
        categoryId: form.categoryId ? parseInt(form.categoryId) : null,
      })
      .then((res) => {
        setPhase("done");
        burstFrom(saveBtn.current, { count: 7, spread: 0.8 });
        toast.success("Expense added");
        setTimeout(() => navigate("/list", { state: { fresh: res?.data?.id } }), 380);
      })
      .catch(() => {
        setPhase("idle");
        toast.error("Failed to add expense");
      });
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page">
        <StatusBanner />
        <header className="page-head fade-in">
          <div>
            <div className="eyebrow">New entry</div>
            <h2>Add expense</h2>
          </div>
          <button className="btn btn-ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={16} /> Back
          </button>
        </header>

        <div className="entry-layout">
        <div className="entry-main">
        <form className="card fade-in" onSubmit={submitExpense}>
          <div className="form-grid">
            <div className="field">
              <label>Amount ({currencySymbol()})</label>
              <input ref={amountRef} className="input" type="number" step="0.01" name="amount" value={form.amount}
                onChange={handleChange} required placeholder="0.00" />
            </div>
            <div className="field">
              <label>Date</label>
              <DatePicker name="date" value={form.date} onChange={handleChange} required />
            </div>
            <div className="field span-2">
              <label>Description</label>
              <input className="input" type="text" name="description" value={form.description}
                onChange={handleChange} required placeholder="e.g. Grocery shopping" />
            </div>
            <div className="field span-2">
              <label>Category</label>
              <Select
                name="categoryId"
                value={form.categoryId}
                onChange={handleChange}
                required
                placeholder="Select category"
                options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              ref={saveBtn}
              type="submit"
              className={`btn btn-primary btn-save ${phase === "done" ? "is-done" : ""}`}
              disabled={phase !== "idle"}
              aria-busy={phase === "saving"}
            >
              {phase === "saving" && <Loader2 size={17} className="spinner" />}
              {phase === "done" && <Check size={17} className="draw-check" strokeWidth={3} />}
              {phase === "done" ? "Added" : phase === "saving" ? "Saving" : "Add expense"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate("/list")}>Cancel</button>
          </div>
        </form>

          <section className="card fade-in">
            <div className="card-head" style={{ marginBottom: 8 }}>
              <div>
                <h3 className="card-title">Recent</h3>
                <div className="card-sub">Tap one to reuse it</div>
              </div>
            </div>
            {recent.length === 0 ? (
              <div className="empty" style={{ padding: "22px 8px" }}>
                <Receipt size={28} />
                <p>Your latest expenses will show up here.</p>
              </div>
            ) : (
              <div className="recent-list">
                {recent.map((e) => {
                  const name = e.category?.name || "";
                  return (
                    <button type="button" className="recent-item" key={e.id} onClick={() => reuse(e)}>
                      <span className="tx-icon" style={{ background: colorFor(name || e.description) }}>
                        {(e.description || "?").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="recent-main">
                        <strong>{e.description}</strong>
                        <span>{name || "No category"}</span>
                      </span>
                      <span className="recent-amt">{money(e.amount)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="entry-side">
          <section className="card receipt fade-in" style={{ "--rc": accent }}>
            <div className="eyebrow" style={{ marginBottom: 0 }}>Preview</div>
            <div className={`receipt-amount ${amountBase > 0 ? "" : "empty"}`}>{money(amountBase)}</div>
            <div className="receipt-rows">
              <div className="receipt-row">
                <span>Description</span>
                <span className={form.description ? "" : "faint"}>{form.description.trim() || "Not set"}</span>
              </div>
              <div className="receipt-row">
                <span>Category</span>
                <span className={picked ? "" : "faint"}>
                  {picked && <span className="dot" style={{ background: accent }} />}
                  {picked ? picked.name : "Not set"}
                </span>
              </div>
              <div className="receipt-row">
                <span>Date</span>
                <span>{dateLabel}</span>
              </div>
            </div>

            <div className="impact">
              {limit > 0 ? (
                <>
                  <div className="impact-top">
                    <span>{monthName} budget</span>
                    <strong>{money(Math.max(0, limit - spentSoFar - amountBase))} left</strong>
                  </div>
                  <div className="progress stack" aria-hidden="true">
                    <span style={{ width: `${usedPct}%`, background: "var(--muted)" }} />
                    <span style={{ width: `${thisPct}%`, background: after < 0 ? "var(--coral)" : accent || "var(--violet)" }} />
                  </div>
                  <p className={`impact-note ${after < 0 ? "bad" : amountBase > 0 ? "good" : ""}`}>
                    {amountBase <= 0
                      ? `${money(limit - spentSoFar)} of ${money(limit)} still available.`
                      : after < 0
                        ? `This puts you ${money(-after)} over your ${monthName} budget.`
                        : `Fits your budget, leaving ${money(after)}.`}
                  </p>
                </>
              ) : (
                <p className="impact-note">
                  No budget set for {monthName || "this month"}.{" "}
                  <button type="button" className="link-btn" onClick={() => navigate("/budget")}>Set one</button>
                </p>
              )}
            </div>
          </section>
        </aside>
        </div>
      </main>
    </div>
  );
}
