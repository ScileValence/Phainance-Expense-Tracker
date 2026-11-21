import Select from "../components/ui/Select";
import DatePicker from "../components/ui/DatePicker";
import TimePicker from "../components/ui/TimePicker";
import React, { useContext, useEffect, useState } from "react";
import api from "../api/axios";
import { useCategories } from "../utils/categories";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Repeat, CalendarClock, Check, SkipForward, Pause, Play, Pencil, Trash2, X,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import NotificationSettings from "../components/NotificationSettings";
import StatusBanner from "../components/StatusBanner";
import { toBase, toInput, currencySymbol } from "../utils/currency";
import { AppContext } from "../context/AppContext";
import { colorFor } from "../utils/palette";
import {
  UNITS, hhmm, isDue, isSoon, intervalLabel, formatDue, relativeDue, money,
} from "../utils/recurring";
import { burst, centerOf } from "../utils/motion";
import "../styles/dashboard.css";

const todayStr = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({
  title: "",
  amount: "",
  categoryId: "",
  intervalValue: 1,
  intervalUnit: "MONTHS",
  nextDueDate: todayStr(),
  dueTime: "09:00",
});

export default function Recurring() {
  const navigate = useNavigate();
  const { recurring, loadRecurring, confirmRecurring, skipRecurring, now } = useContext(AppContext);
  const { categories } = useCategories();
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRecurring();
  }, [navigate, loadRecurring]);

  const set = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const reset = () => {
    setForm(emptyForm());
    setEditId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      amount: toBase(form.amount),
      categoryId: form.categoryId ? parseInt(form.categoryId) : null,
      intervalValue: parseInt(form.intervalValue),
      intervalUnit: form.intervalUnit,
      nextDueDate: form.nextDueDate,
      dueTime: form.dueTime || "09:00",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    try {
      if (editId) await api.put(`/recurring/${editId}`, payload);
      else await api.post("/recurring", payload);
      toast.success(editId ? "Recurring payment updated" : "Recurring payment added");
      reset();
      await loadRecurring();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (r) => {
    setEditId(r.id);
    setForm({
      title: r.title,
      amount: toInput(r.amount),
      categoryId: r.category?.id || "",
      intervalValue: r.intervalValue,
      intervalUnit: r.intervalUnit,
      nextDueDate: r.nextDueDate,
      dueTime: hhmm(r.dueTime),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const act = async (fn, okMsg) => {
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      await loadRecurring();
      return true;
    } catch {
      toast.error("Something went wrong");
      return false;
    }
  };

  const toggle = (r) => act(() => api.post(`/recurring/${r.id}/toggle`), r.active ? "Paused" : "Resumed");
  const remove = (r) => {
    if (!window.confirm(`Delete "${r.title}"?`)) return;
    act(() => api.delete(`/recurring/${r.id}`), "Deleted");
    if (editId === r.id) reset();
  };

  const monthlyTotal = recurring
    .filter((r) => r.active)
    .reduce((s, r) => {
      const n = r.intervalValue || 1;
      const perMonth = r.intervalUnit === "DAYS" ? (r.amount * 30) / n : r.intervalUnit === "WEEKS" ? (r.amount * 52) / 12 / n : r.amount / n;
      return s + perMonth;
    }, 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page">
        <StatusBanner />
        <header className="page-head fade-in">
          <div>
            <div className="eyebrow">Reminders</div>
            <h2>Recurring payments</h2>
            <p className="sub">≈ {money(Math.round(monthlyTotal))} / month across {recurring.filter((r) => r.active).length} active</p>
          </div>
        </header>

        <div className="rec-layout">
          {/* form */}
          <form className="card rec-form fade-in" onSubmit={submit}>
            <div className="card-head">
              <h3 className="card-title">{editId ? "Edit payment" : "New payment"}</h3>
              {editId && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                  <X size={14} /> Cancel
                </button>
              )}
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="field">
                <label>Title</label>
                <input className="input" name="title" value={form.title} onChange={set} placeholder="e.g. Rent, Netflix" required />
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>Amount ({currencySymbol()})</label>
                  <input className="input" type="number" step="0.01" min="0.01" name="amount" value={form.amount} onChange={set} placeholder="0.00" required />
                </div>
                <div className="field">
                  <label>Category</label>
                  <Select
                    name="categoryId"
                    value={form.categoryId}
                    onChange={set}
                    required
                    placeholder="Select"
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </div>
              </div>

              <div className="field">
                <label>Repeat every</label>
                <div className="interval-row">
                  <input className="input" type="number" min="1" max="1000" name="intervalValue" value={form.intervalValue} onChange={set} required />
                  <Select
                    name="intervalUnit"
                    value={form.intervalUnit}
                    onChange={set}
                    options={UNITS.map((u) => ({ value: u.value, label: Number(form.intervalValue) === 1 ? u.one : u.many }))}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>Next due date</label>
                  <DatePicker name="nextDueDate" value={form.nextDueDate} onChange={set} required />
                </div>
                <div className="field">
                  <label>Remind at</label>
                  <TimePicker name="dueTime" value={form.dueTime} onChange={set} required />
                </div>
              </div>

              <p className="hint">You’ll get a reminder at that date and time. It’s only logged as an expense when you mark it paid.</p>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {editId ? "Save changes" : "Add recurring payment"}
              </button>
            </div>
          </form>

          {/* list */}
          <section className="rec-list stagger">
            <NotificationSettings />
            {recurring.length === 0 ? (
              <div className="card empty">
                <Repeat size={36} />
                <p>No recurring payments yet. Add your rent, subscriptions or bills.</p>
              </div>
            ) : (
              recurring.map((r) => {
                const due = isDue(r, now);
                const soon = isSoon(r, now);
                const catName = r.category?.name;
                return (
                  <div key={r.id} className={`rec-item ${due ? "is-due" : ""} ${!r.active ? "is-paused" : ""}`}>
                    <div className="tx-icon" style={{ background: colorFor(catName || r.title) }}>
                      {r.title.slice(0, 1).toUpperCase()}
                    </div>

                    <div className="rec-main">
                      <div className="rec-title">
                        <strong>{r.title}</strong>
                        {!r.active && <span className="badge">Paused</span>}
                        {due && <span className="badge badge-due">Due · {relativeDue(r, now)}</span>}
                        {soon && !due && <span className="badge badge-soon">{relativeDue(r, now)}</span>}
                      </div>
                      <div className="rec-meta">
                        <span><CalendarClock size={14} /> {formatDue(r)}</span>
                        <span><Repeat size={14} /> {intervalLabel(r)}</span>
                        {catName && <span><span className="dot" style={{ background: colorFor(catName) }} /> {catName}</span>}
                      </div>
                    </div>

                    <div className="rec-side">
                      <div className="rec-amount">{money(r.amount)}</div>
                      <div className="rec-actions">
                        {due && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={(e) => {
                              const { x, y } = centerOf(e.currentTarget); // the payment is a rare, meaningful moment: bigger burst
                              act(() => confirmRecurring(r.id), "Logged as expense").then((ok) => ok && burst(x, y, { count: 12, spread: 1.15 }));
                            }}>
                              <Check size={14} /> Paid
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => act(() => skipRecurring(r.id), "Skipped")}>
                              <SkipForward size={14} /> Skip
                            </button>
                          </>
                        )}
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => toggle(r)} aria-label={r.active ? "Pause" : "Resume"}>
                          {r.active ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => startEdit(r)} aria-label="Edit"><Pencil size={14} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(r)} aria-label="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
