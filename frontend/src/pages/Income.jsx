import DatePicker from "../components/ui/DatePicker";
import MonthPicker from "../components/ui/MonthPicker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { toast } from "react-toastify";
import { Wallet, Pencil, Trash2, X, Check } from "lucide-react";
import { burstFrom } from "../utils/motion";
import Sidebar from "../components/Sidebar";
import StatusBanner from "../components/StatusBanner";
import { SOURCES, sourceMeta } from "../utils/income";
import { money, toBase, toInput, currencySymbol } from "../utils/currency";
import "../styles/dashboard.css";

const todayStr = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ amount: "", source: "SALARY", description: "", date: todayStr() });

export default function Income() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(
    localStorage.getItem("selectedMonth") || new Date().toISOString().slice(0, 7)
  );

  const load = useCallback(
    () =>
      api
        .get(`/income?month=${month}`)
        .then((r) => setItems(r.data || []))
        .catch(() => toast.error("Failed to load income")),
    [month]
  );

  useEffect(() => {
    load();
  }, [load]);

  const set = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };
  const reset = () => {
    setForm(emptyForm());
    setEditId(null);
  };

  const [done, setDone] = useState(false);
  const saveBtn = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      amount: toBase(form.amount),
      source: form.source,
      description: form.description.trim(),
      date: form.date,
    };
    try {
      if (editId) await api.put(`/income/${editId}`, payload);
      else await api.post("/income", payload);
      toast.success(editId ? "Income updated" : "Income added");
      if (!editId) {
        setDone(true);
        burstFrom(saveBtn.current, { count: 7, spread: 0.8 });
        setTimeout(() => setDone(false), 900);
      }
      reset();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (i) => {
    setEditId(i.id);
    setForm({ amount: toInput(i.amount), source: i.source, description: i.description || "", date: i.date });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (i) => {
    if (!window.confirm("Delete this income entry?")) return;
    try {
      await api.delete(`/income/${i.id}`);
      toast.info("Income deleted");
      if (editId === i.id) reset();
      load();
    } catch {
      toast.error("Error deleting income");
    }
  };

  const total = items.reduce((s, i) => s + (i.amount || 0), 0);
  const bySource = SOURCES.map((s) => ({
    ...s,
    total: items.filter((i) => i.source === s.value).reduce((sum, i) => sum + (i.amount || 0), 0),
  }));
  const monthLabel = new Date(`${month}-01`).toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page">
        <StatusBanner />
        <header className="page-head fade-in">
          <div>
            <div className="eyebrow">{monthLabel}</div>
            <h2>Income</h2>
            <p className="sub">{items.length} entries · {money(total)} total</p>
          </div>
          <div className="head-controls">
            <MonthPicker
              variant="pill"
              align="right"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                localStorage.setItem("selectedMonth", e.target.value);
              }}
            />
          </div>
        </header>

        <div className="rec-layout">
          <form className="card rec-form fade-in" onSubmit={submit}>
            <div className="card-head">
              <h3 className="card-title">{editId ? "Edit income" : "Add income"}</h3>
              {editId && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                  <X size={14} /> Cancel
                </button>
              )}
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="field">
                <label>Source</label>
                <div className="chip-group">
                  {SOURCES.map((s) => (
                    <button
                      type="button"
                      key={s.value}
                      className={`chip ${form.source === s.value ? "active" : ""}`}
                      style={form.source === s.value ? { background: s.color, borderColor: s.color } : undefined}
                      onClick={() => setForm((f) => ({ ...f, source: s.value }))}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>Amount ({currencySymbol()})</label>
                  <input className="input" type="number" step="0.01" min="0.01" name="amount"
                    value={form.amount} onChange={set} placeholder="0.00" required />
                </div>
                <div className="field">
                  <label>Date</label>
                  <DatePicker name="date" value={form.date} onChange={set} required />
                </div>
              </div>

              <div className="field">
                <label>Note (optional)</label>
                <input className="input" name="description" value={form.description} onChange={set}
                  placeholder="e.g. November salary, logo design" />
              </div>
            </div>

            <div className="form-actions">
              <button ref={saveBtn} type="submit" className={`btn btn-primary btn-save ${done ? "is-done" : ""}`} disabled={saving || done} aria-busy={saving}>
                {done && <Check size={17} className="draw-check" strokeWidth={3} />}
                {done ? "Added" : editId ? "Save changes" : "Add income"}
              </button>
            </div>
          </form>

          <section className="rec-list stagger">
            <div className="card fade-in">
              <div className="card-head">
                <h3 className="card-title">By source</h3>
                <div className="card-sub">{monthLabel}</div>
              </div>
              <div className="source-grid">
                {bySource.map((s) => (
                  <div className="source-tile" key={s.value}>
                    <span className="dot" style={{ background: s.color }} />
                    <div>
                      <strong>{money(s.total)}</strong>
                      <span>{s.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="card empty">
                <Wallet size={36} />
                <p>No income recorded for this month.</p>
              </div>
            ) : (
              <div className="card">
                <div className="tx-list">
                  {items.map((i) => {
                    const meta = sourceMeta(i.source);
                    return (
                      <div className="tx" key={i.id}>
                        <div className="tx-icon" style={{ background: meta.color, color: "#fff" }}>
                          {meta.label.slice(0, 1)}
                        </div>
                        <div className="tx-main">
                          <strong>{i.description || meta.label}</strong>
                          <span>{meta.label} · {i.date}</span>
                        </div>
                        <div className="tx-amt" style={{ color: "var(--ok)" }}>+{money(i.amount)}</div>
                        <div className="row-actions">
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => startEdit(i)} aria-label="Edit"><Pencil size={14} /></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(i)} aria-label="Delete"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
